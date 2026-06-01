/**
 * React = frontend only (UI)
 * Rails = backend only (JSON API + jobs) on :3001
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { concurrently } = require("concurrently");

const PID_FILE = path.join(__dirname, "..", "api", "tmp", "pids", "server.pid");
const API_HEALTH = "http://127.0.0.1:3001/health";

function checkHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => resolve(res.statusCode === 200));
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

function cleanStalePid() {
  if (!fs.existsSync(PID_FILE)) return;
  const pid = parseInt(fs.readFileSync(PID_FILE, "utf8"), 10);
  try { process.kill(pid, 0); } catch { fs.unlinkSync(PID_FILE); }
}

async function main() {
  cleanStalePid();
  const apiUp = await checkHealth(API_HEALTH);

  const cmds = [];
  const names = [];
  const colors = [];

  if (!apiUp) {
    cmds.push("cd api && bundle exec rails server -p 3001 -b 127.0.0.1");
    names.push("api");
    colors.push("blue");
  }

  const wait = "npx wait-on -t 120000 http://127.0.0.1:3001/health";
  cmds.push(`${wait} && cd frontend && npm start`);
  names.push("react");
  colors.push("magenta");

  console.log("\n  Kids Shop");
  console.log("  React (UI):     http://localhost:3000");
  console.log("  Rails (API):    http://localhost:3001");
  console.log("  Connexion:      http://localhost:3000/connexion");
  console.log("  Admin (staff):  http://localhost:3000/admin");
  console.log("  Staff: admin@kids-shop.local / password123\n");

  await concurrently(cmds, { names, prefixColors: colors, killOthersOn: ["failure"] }).result;
}

main().catch((e) => { console.error(e); process.exit(1); });
