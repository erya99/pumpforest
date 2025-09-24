'use client';

import React, { useEffect, useRef, useState } from 'react';

type Source = 'wallets_current' | 'debug_holders' | 'rounds_latest';

type Tree = {
  id: string;
  x: number;
  y: number;
  size: number;
  currentSize: number;
  alpha: number;
  removing?: boolean;
  removeAt?: number;
};

type HolderLite = { addr: string; balance?: number };

// assets
const BG_URL = '/assets/arena/grass.png';
const TREE_URL = '/tree.png';

// polling ve yerleşim ayarları
const POLL_MS = 15000 + Math.floor(Math.random() * 5000);

// Ekranda daha çok ağaç barındırmak için hücre ve çizim boyutları
// (sprite 16x16 ama ekrana 12px olarak çiziyoruz; aralık 14px)
const TREE_DRAW_SIZE = 12; // ekrana çizilen ağaç boyutu
const CELL = 14;           // grid hücre adımı (px)

// HUD (başlık paneli) ayarları
const HUD_PADDING = 12;
const HUD_BG = 'rgba(0,0,0,0.45)';
const HUD_TEXT = '#ffffff';

export default function WalletForest() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const treesRef = useRef<Map<string, Tree>>(new Map());
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const treeImgRef = useRef<HTMLImageElement | null>(null);
  const animRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  // debug amaçlı
  const [activeSource, setActiveSource] = useState<Source | null>(null);

  // sadece gerçek holderlar (sayaç bu setten)
  const authoritativeIdsRef = useRef<Set<string>>(new Set());

  // ---- ekran boyutu ve DPI ayarı ----
  useEffect(() => {
    const c = canvasRef.current!;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- görseller ----
  useEffect(() => {
    const bg = new Image();
    bg.src = BG_URL;
    bg.onload = () => (bgImgRef.current = bg);

    const tree = new Image();
    tree.src = TREE_URL;
    tree.onload = () => (treeImgRef.current = tree);
  }, []);

  // ---- API yardımcıları ----
  async function fetchWalletsCurrent(): Promise<string[]> {
    try {
      const r = await fetch('/api/wallets/current', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        const ids = Array.isArray(j?.ids)
          ? j.ids
          : ((j?.holders as HolderLite[] | undefined)?.map(h => h.addr) ?? []);
        if (ids.length > 0) setActiveSource('wallets_current');
        return ids;
      }
    } catch {}
    return [];
  }

  async function fetchDebugHolders(): Promise<string[]> {
    try {
      const r = await fetch('/api/debug/holders', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        const ids = Array.isArray(j?.ids)
          ? j.ids
          : ((j?.holders as HolderLite[] | undefined)?.map(h => h.addr) ?? []);
        if (ids.length > 0) setActiveSource('debug_holders');
        return ids;
      }
    } catch {}
    return [];
  }

  async function fetchRoundsParticipants(): Promise<string[]> {
    try {
      const r = await fetch('/api/rounds/latest', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        const ids: string[] = j?.round?.participants ?? [];
        if (ids.length > 0) setActiveSource('rounds_latest');
        return ids;
      }
    } catch {}
    return [];
  }

  // ---- kare spiral: merkezden dikdörtgen genişleme ----
  // i=0 (0,0), sonra sağ 1, yukarı 1, sol 2, aşağı 2, sağ 3, ...
  function squareSpiral(i: number): { gx: number; gy: number } {
    if (i === 0) return { gx: 0, gy: 0 };
    let x = 0, y = 0;
    let step = 1;
    let n = 0;

    // her döngüde iki yön (sağ&yukarı, sol&aşağı) ile step ilerlenir, sonra step++
    while (true) {
      // sağ
      for (let k = 0; k < step; k++) {
        x += 1; n++;
        if (n === i) return { gx: x, gy: y };
      }
      // yukarı
      for (let k = 0; k < step; k++) {
        y -= 1; n++;
        if (n === i) return { gx: x, gy: y };
      }
      step++;
      // sol
      for (let k = 0; k < step; k++) {
        x -= 1; n++;
        if (n === i) return { gx: x, gy: y };
      }
      // aşağı
      for (let k = 0; k < step; k++) {
        y += 1; n++;
        if (n === i) return { gx: x, gy: y };
      }
      step++;
    }
  }

  // ---- ağaç ekleme (dikdörtgen düzen) ----
  function addTree(id: string) {
    if (treesRef.current.has(id)) return;

    const c = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const viewW = c.width / dpr;
    const viewH = c.height / dpr;
    const cx = viewW / 2;
    const cy = viewH / 2;

    const index = treesRef.current.size; // kaçıncı ağaç
    const { gx, gy } = squareSpiral(index);

    const x = cx + gx * CELL;
    const y = cy + gy * CELL;

    treesRef.current.set(id, {
      id,
      x,
      y,
      size: TREE_DRAW_SIZE,
      currentSize: Math.max(2, TREE_DRAW_SIZE * 0.4),
      alpha: 0,
    });
  }

  function removeTree(id: string) {
    const t = treesRef.current.get(id);
    if (!t) return;
    t.removing = true;
    t.removeAt = performance.now();
  }

  // ---- polling döngüsü ----
  useEffect(() => {
    let stop = false;
    (async function loop() {
      while (!stop) {
        try {
          // 1) authoritative: wallets_current → boşsa debug
          const wc = await fetchWalletsCurrent();
          let authoritative: string[] = wc;
          if (authoritative.length === 0) {
            const dbg = await fetchDebugHolders();
            if (dbg.length > 0) authoritative = dbg;
          }
          if (authoritative.length > 0) {
            authoritativeIdsRef.current = new Set(authoritative);
          }

          // 2) görsel zenginlik için rounds
          const rnd = await fetchRoundsParticipants();

          // 3) birleştir
          const unionIds = new Set<string>([
            ...authoritativeIdsRef.current,
            ...rnd,
          ]);

          // ekle/çıkar
          for (const id of unionIds) {
            if (!treesRef.current.has(id)) addTree(id);
          }
          for (const [id] of treesRef.current) {
            if (!unionIds.has(id)) removeTree(id);
          }
        } catch {}
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    })();
    return () => { stop = true; };
  }, []);

  // ---- çizim yardımcıları ----
  function drawTree(ctx: CanvasRenderingContext2D, t: Tree, sprite: HTMLImageElement) {
    ctx.save();
    ctx.globalAlpha = t.alpha;
    const s = t.currentSize;
    const half = s / 2;
    // spritesheet 16x16, ekrana s×s
    ctx.drawImage(sprite, 0, 0, 16, 16, t.x - half, t.y - half, s, s);
    ctx.restore();
  }

  function drawHUD(ctx: CanvasRenderingContext2D, viewW: number) {
    const walletCount = authoritativeIdsRef.current.size;
    const donated = Math.floor(walletCount / 50);

    // panel ölçüsü
    const boxW = Math.min(380, viewW - 2 * HUD_PADDING);
    const boxH = 96;
    const x = HUD_PADDING;
    const y = HUD_PADDING;

    // gölge
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    roundRect(ctx, x + 2, y + 3, boxW, boxH, 12);
    ctx.fill();
    ctx.restore();

    // panel
    ctx.save();
    ctx.fillStyle = HUD_BG;
    ctx.beginPath();
    roundRect(ctx, x, y, boxW, boxH, 12);
    ctx.fill();

    // metinler
    ctx.fillStyle = HUD_TEXT;
    ctx.textAlign = 'left';

    ctx.font = 'bold 22px Inter, Arial';
    ctx.fillText(`Wallets: ${walletCount}`, x + 16, y + 30);

    ctx.font = '14px Inter, Arial';
    ctx.fillText(`For every 50 wallets, we will donate 1 tree.`, x + 16, y + 54);

    ctx.font = '14px Inter, Arial';
    ctx.fillText(`Current number of donated trees: ${donated}`, x + 16, y + 74);

    ctx.restore();

    // kaynak etiketi (küçük, sol üstte)
    if (typeof activeSource === 'string') {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.font = '11px Inter, Arial';
      ctx.fillStyle = '#e6e6e6';
      ctx.textAlign = 'left';
      ctx.fillText(`source: ${activeSource}`, x + 16, y - 6);
      ctx.restore();
    }
  }

  // yuvarlak köşeli dikdörtgen yardımcı
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // ---- render döngüsü ----
  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    function draw(ts: number) {
      const dt = ts - (lastTsRef.current || ts);
      lastTsRef.current = ts;

      const viewW = c.width / dpr;
      const viewH = c.height / dpr;

      // arka plan
      if (bgImgRef.current) {
        const pattern = ctx.createPattern(bgImgRef.current, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, viewW, viewH);
        }
      } else {
        ctx.fillStyle = '#0b2b12';
        ctx.fillRect(0, 0, viewW, viewH);
      }

      // ağaçlar
      const now = performance.now();
      for (const t of Array.from(treesRef.current.values())) {
        if (!t.removing) {
          t.currentSize += (t.size - t.currentSize) * Math.min(0.25, 0.08 + (dt / 1000) * 0.35);
          t.alpha += (1 - t.alpha) * 0.12;
        } else {
          const elapsed = now - (t.removeAt || now);
          t.alpha = Math.max(0, 1 - elapsed / 400);
          t.currentSize = Math.max(2, t.currentSize * 0.96);
          if (t.alpha <= 0.02) {
            treesRef.current.delete(t.id);
            continue;
          }
        }
        if (treeImgRef.current) drawTree(ctx, t, treeImgRef.current);
      }

      // HUD
      drawHUD(ctx, viewW);

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [activeSource]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, display: 'block', zIndex: 0 }}
    />
  );
}
