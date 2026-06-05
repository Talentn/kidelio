/**
 * Stops React (3000) and Rails API (3001) so `npm run dev` can start clean.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORTS = [3000, 3001, 3010];
const PID_FILE = path.join(__dirname, "..", "api", "tmp", "pids", "server.pid");

function killPid(pid, port) {
  if (!pid || pid <= 0) return;
  try {
    process.kill(pid, "SIGTERM");
    console.log(`[stop] Port ${port} — stopped PID ${pid}`);
  } catch {
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`[stop] Port ${port} — force-killed PID ${pid}`);
      } catch {
        /* already gone */
      }
    }
  }
}

function pidsOnPortWin(port) {
  const pids = new Set();
  try {
    const out = execSync(`netstat -ano -p tcp`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    const needle = `:${port}`;
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING") || !line.includes(needle)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      if (pid > 0) pids.add(pid);
    }
  } catch {
    /* none */
  }
  return pids;
}

function pidsOnPortUnix(port) {
  const pids = new Set();
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
    for (const line of out.trim().split(/\s+/)) {
      const pid = parseInt(line, 10);
      if (pid > 0) pids.add(pid);
    }
  } catch {
    /* none */
  }
  return pids;
}

function pidsOnPort(port) {
  return process.platform === "win32" ? pidsOnPortWin(port) : pidsOnPortUnix(port);
}

for (const port of PORTS) {
  for (const pid of pidsOnPort(port)) {
    killPid(pid, port);
  }
}

if (fs.existsSync(PID_FILE)) {
  fs.unlinkSync(PID_FILE);
  console.log("[stop] Removed api/tmp/pids/server.pid");
}

console.log("[stop] Ports 3000 (React), 3001 (API), and 3010 (Go) should be free. Run: npm run dev");
