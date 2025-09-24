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

const BG_URL = '/assets/arena/grass.png';
const TREE_URL = '/tree.png';
const POLL_MS = 15000 + Math.floor(Math.random() * 5000);
const GOLDEN_ANGLE = 2.399963229728653;
const SPACING = 18;

export default function WalletForest() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const treesRef = useRef<Map<string, Tree>>(new Map());
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const treeImgRef = useRef<HTMLImageElement | null>(null);
  const animRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  // Görsel kaynak notu (debug)
  const [activeSource, setActiveSource] = useState<Source | null>(null);

  // ✅ Sadece gerçek holder’ların tutulduğu authoritative set
  const authoritativeIdsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const bg = new Image();
    bg.src = BG_URL;
    bg.onload = () => (bgImgRef.current = bg);

    const tree = new Image();
    tree.src = TREE_URL;
    tree.onload = () => (treeImgRef.current = tree);
  }, []);

  // Yardımcı fetch’ler
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

  // Pozisyonlama: merkezden dışa spiral
  function addTree(id: string) {
    if (treesRef.current.has(id)) return;
    const c = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const viewW = c.width / dpr;
    const viewH = c.height / dpr;
    const cx = viewW / 2;
    const cy = viewH / 2;

    const size = 16;
    const index = treesRef.current.size; // mevcut ağaç sayısına göre spiral
    const radius = index === 0 ? 0 : SPACING * Math.sqrt(index);
    const angle = index * GOLDEN_ANGLE;

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    treesRef.current.set(id, {
      id,
      x,
      y,
      size,
      currentSize: 2,
      alpha: 0,
    });
  }

  function removeTree(id: string) {
    const t = treesRef.current.get(id);
    if (!t) return;
    t.removing = true;
    t.removeAt = performance.now();
  }

  // Ana polling döngüsü
  useEffect(() => {
    let stop = false;
    (async function loop() {
      while (!stop) {
        try {
          // 1) Otorite kaynaklar: wallets_current → boşsa debug_holders
          const wc = await fetchWalletsCurrent();
          let authoritative: string[] = wc;
          if (authoritative.length === 0) {
            const dbg = await fetchDebugHolders();
            if (dbg.length > 0) authoritative = dbg;
          }

          // authoritative set’i güncelle (boşsa önceki değeri koru)
          if (authoritative.length > 0) {
            authoritativeIdsRef.current = new Set(authoritative);
          }

          // 2) Görsel zenginlik için rounds (opsiyonel)
          const rnd = await fetchRoundsParticipants();

          // 3) Çizim için birleşik id’ler
          const unionIds = new Set<string>([
            ...authoritativeIdsRef.current,
            ...rnd,
          ]);

          // 4) Ağaç ekle/çıkar (sadece union’a göre)
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

  function drawTree(ctx: CanvasRenderingContext2D, t: Tree, sprite: HTMLImageElement) {
    ctx.save();
    ctx.globalAlpha = t.alpha;
    const s = t.currentSize;
    const half = s / 2;
    ctx.drawImage(sprite, 0, 0, 16, 16, t.x - half, t.y - half, s, s);
    ctx.restore();
  }

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    function draw(ts: number) {
      const dt = ts - (lastTsRef.current || ts);
      lastTsRef.current = ts;

      const viewW = c.width / dpr;
      const viewH = c.height / dpr;

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

      const now = performance.now();
      for (const t of Array.from(treesRef.current.values())) {
        if (!t.removing) {
          t.currentSize += (t.size - t.currentSize) * Math.min(0.25, 0.08 + dt / 1000 * 0.35);
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

      // ✅ Sayaç: sadece authoritative (gerçek holders)
      const walletCount = authoritativeIdsRef.current.size;

      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.font = '48px Inter, Arial';
      ctx.fillStyle = '#000000ff';
      ctx.textAlign = 'center';
      ctx.fillText(`Wallets: ${walletCount}`, viewW / 4, 22);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.font = '24px Inter, Arial';
      ctx.fillStyle = '#020202ff';
      ctx.textAlign = 'center';
      ctx.fillText(`For every 50 wallets, we will donate 1 tree.`, viewW / 8, 44);
      ctx.fillText(`Current number of donated trees: ${Math.floor(walletCount / 50)}`, viewW / 8, 64);
      ctx.restore();

      if (activeSource) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.font = '12px Inter, Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(`source: ${activeSource}`, 12, 20);
        ctx.restore();
      }

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
