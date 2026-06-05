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
const GO_HEALTH = "http://127.0.0.1:3010/health";

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
  const [apiUp, goUp] = await Promise.all([checkHealth(API_HEALTH), checkHealth(GO_HEALTH)]);

  const cmds = [];

  if (!apiUp) {
    cmds.push({
      command: "cd api && bundle exec rails server -p 3001 -b 127.0.0.1",
      name: "api",
      prefixColor: "blue",
    });
  }

  if (!goUp) {
    cmds.push({
      command: "cd go-service && go run .",
      name: "go",
      prefixColor: "green",
      env: {
        PORT: "3010",
        RAILS_URL: "http://127.0.0.1:3001",
        DB_PATH: "./data/go-service.db",
      },
    });
  }

  const wait = "npx wait-on -t 120000 http://127.0.0.1:3001/health http://127.0.0.1:3010/health";
  cmds.push({
    command: `${wait} && cd frontend && npm start`,
    name: "react",
    prefixColor: "magenta",
  });

  console.log("\n  Kids Shop");
  console.log("  React (UI):     http://localhost:3000");
  console.log("  Rails (API):    http://localhost:3001");
  console.log("  Go (chat/cart): http://localhost:3010");
  console.log("  Connexion:      http://localhost:3000/connexion");
  console.log("  Admin (staff):  http://localhost:3000/admin\n");

  await concurrently(cmds, { killOthersOn: ["failure"] }).result;
}

main().catch((e) => { console.error(e); process.exit(1); });
