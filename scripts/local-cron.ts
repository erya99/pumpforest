// scripts/local-cron.js
const TARGET = "http://localhost:3000/api/cron/minutely";
const PERIOD_MS = 180_000; // 3 dakika

console.log("Local cron started:", TARGET, "period:", PERIOD_MS, "ms");

async function tick() {
  try {
    await fetch(TARGET, { method: "POST" });
    console.log(new Date().toISOString(), "POST /api/cron/minutely OK");
  } catch (e) {
    console.error("cron error", e);
  }
}

tick();                     // hemen 1 kez çalıştır
setInterval(tick, PERIOD_MS);
