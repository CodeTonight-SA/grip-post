#!/usr/bin/env node
// grip-post — zip dist/ into grip-post-<version>.zip for Chrome Web Store
// upload. Uses platform `zip` (macOS / Linux / WSL / Git Bash all ship it).
// No npm dependency. Single shell-out, no archiver, no third-party module —
// the simplest thing that works (KISS).

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const version = pkg.version;
const ZIP_NAME = `grip-post-${version}.zip`;
const ZIP_PATH = resolve(ROOT, ZIP_NAME);

if (!existsSync(resolve(ROOT, "dist"))) {
  console.error(
    "[package] dist/ missing — run `npm run build` first.",
  );
  process.exit(1);
}

if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);

try {
  execFileSync("zip", ["-r", ZIP_PATH, "."], {
    cwd: resolve(ROOT, "dist"),
    stdio: "inherit",
  });
} catch (err) {
  console.error(`[package] zip failed: ${err.message}`);
  console.error(
    "[package] Need the system `zip` utility (preinstalled on macOS, Linux, " +
      "Git Bash on Windows). On Debian/Ubuntu: `sudo apt-get install zip`.",
  );
  process.exit(1);
}

const sizeBytes = execSync(`wc -c < "${ZIP_PATH}"`).toString().trim();
console.log(`\n[package] ${ZIP_NAME} (${sizeBytes} bytes) ready.`);
console.log(
  `[package] Upload to https://chrome.google.com/webstore/devconsole/`,
);
