const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "frontend", "build");
const dest = path.join(__dirname, "..", "api", "public");

if (!fs.existsSync(src)) {
  console.error("Run: cd frontend && npm run build");
  process.exit(1);
}

fs.cpSync(src, dest, { recursive: true });
console.log("Copied frontend/build → api/public (single-site production)");
