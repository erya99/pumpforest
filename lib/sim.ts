// lib/sim.ts
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStringToSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

export function simulateBattle(participants: string[], seedStr: string) {
  const rnd = mulberry32(hashStringToSeed(seedStr));
  const alive = [...participants];
  const log: string[] = [];
  while (alive.length > 1) {
    const i = Math.floor(rnd() * alive.length);
    let j = Math.floor(rnd() * alive.length);
    if (j === i) j = (j + 1) % alive.length;
    const A = alive[i], B = alive[j];
    const winner = rnd() < 0.5 ? A : B;
    const loser = winner === A ? B : A;
    const idx = alive.indexOf(loser);
    if (idx >= 0) alive.splice(idx, 1);
    log.push(`⚔️ ${shortAddr(winner)} defeated ${shortAddr(loser)}`);
  }
  return { winner: alive[0], log };
}

function shortAddr(a: string) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}
