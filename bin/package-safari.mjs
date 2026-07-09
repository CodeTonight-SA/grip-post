#!/usr/bin/env node
// Package the Safari target: run Apple's safari-web-extension-converter over
// dist-safari/ to generate an Xcode project.
//
// Safari Web Extensions must be built into a signed app bundle by FULL Xcode —
// unlike Chrome, there is no "load unpacked" folder. This script fails LOUD
// with the exact remedy when Xcode is absent; it is never a silent no-op.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const DIST = "dist-safari";
const APP_NAME = "grip-post";
const BUNDLE_ID = "za.co.codetonight.grip-post";

if (!existsSync(DIST)) {
  console.error(`[package:safari] ${DIST}/ not found. Run: npm run build:safari`);
  process.exit(1);
}

// The converter lives inside Xcode.app, not the Command Line Tools. `xcrun
// --find` resolves it only when full Xcode is the active developer dir.
let converter;
try {
  converter = execSync("xcrun --find safari-web-extension-converter", {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
} catch {
  console.error(
    [
      "[package:safari] safari-web-extension-converter not found.",
      "",
      "Safari Web Extensions must be built into an app bundle by FULL Xcode",
      "(the Command Line Tools alone are not enough).",
      "",
      "Fix:",
      "  1. Install Xcode from the App Store (~7 GB).",
      "  2. sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
      "  3. npm run package:safari",
      "",
      "Meanwhile — test-drive grip-post in Safari with ZERO install:",
      "  npm run dev:web    then open the printed localhost URL in Safari",
    ].join("\n"),
  );
  process.exit(2);
}

const cmd = [
  "xcrun safari-web-extension-converter",
  DIST,
  `--app-name "${APP_NAME}"`,
  `--bundle-identifier ${BUNDLE_ID}`,
  "--macos-only",
  "--no-open",
  "--force",
].join(" ");

console.log(`[package:safari] using ${converter}`);
console.log(`[package:safari] ${cmd}`);
execSync(cmd, { stdio: "inherit" });

console.log(
  [
    "",
    "[package:safari] Xcode project generated.",
    "Next:",
    "  1. Open the generated .xcodeproj, then Build (Cmd-B).",
    "  2. Safari -> Settings -> Extensions: enable grip-post.",
    "     (Dev build: Develop -> Allow Unsigned Extensions first.)",
  ].join("\n"),
);
