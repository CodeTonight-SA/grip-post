#!/usr/bin/env node
// grip-post — post-build artefact verifier.
//
// Capability-lock at the build-output level (per
// rules/untrusted-content-capability-lock.md). Vite's @crxjs plugin
// rewrites manifest paths (src/content.ts → assets/content.ts-loader-*.js)
// but MUST NEVER widen permissions or host_permissions. A regression
// here — accidentally adding `<all_urls>` or `cookies` permission — would
// pass typecheck + lint + unit tests and ship a privacy disaster. This
// verifier asserts the artefact matches the contract that source code
// promised, NOT the source itself.
//
// Goodhart-proof: a mutation that adds a permission to src/manifest.json
// fails this gate at build time, before any package or release.

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

/** Files that MUST exist post-build. Missing = build broken. */
const REQUIRED_FILES = [
  "dist/manifest.json",
  "dist/service-worker-loader.js",
  "dist/src/sidepanel.html",
];

/** Directories that MUST exist post-build. */
const REQUIRED_DIRS = ["dist/assets"];

/**
 * Permission contract. Source declares these EXACTLY. Build output may
 * not widen the set. Adding a permission requires editing this allowlist
 * AND src/manifest.json in the same PR (review-gate).
 */
const ALLOWED_PERMISSIONS = new Set(["contextMenus", "storage", "sidePanel"]);

/**
 * Host permission contract. Source allows linkedin.com ONLY. Build output
 * may not widen the set. A regression that adds <all_urls> ships a
 * privacy disaster; this assertion is the floor.
 */
const ALLOWED_HOST_PERMISSIONS = new Set(["https://www.linkedin.com/*"]);

/** Content script match contract. Source binds to feed + profile pages only. */
const ALLOWED_CONTENT_SCRIPT_MATCHES = new Set([
  "https://www.linkedin.com/feed/*",
  "https://www.linkedin.com/in/*",
]);

const errors = [];

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ok  ${label}`);
  } else {
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    errors.push(label);
  }
}

console.log("\n[verify-build] post-build artefact verification\n");

console.log("Required files:");
for (const rel of REQUIRED_FILES) {
  const p = resolve(ROOT, rel);
  check(rel, existsSync(p) && statSync(p).isFile());
}

console.log("\nRequired directories:");
for (const rel of REQUIRED_DIRS) {
  const p = resolve(ROOT, rel);
  check(rel, existsSync(p) && statSync(p).isDirectory());
}

console.log("\nManifest contract:");
const manifestPath = resolve(ROOT, "dist/manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  check(
    "manifest_version === 3",
    manifest.manifest_version === 3,
    `got ${manifest.manifest_version}`,
  );

  const perms = new Set(manifest.permissions ?? []);
  const extraPerms = [...perms].filter((p) => !ALLOWED_PERMISSIONS.has(p));
  check(
    "permissions: no widening",
    extraPerms.length === 0,
    extraPerms.length ? `unexpected: ${extraPerms.join(", ")}` : "",
  );

  const hosts = new Set(manifest.host_permissions ?? []);
  const extraHosts = [...hosts].filter(
    (h) => !ALLOWED_HOST_PERMISSIONS.has(h),
  );
  check(
    "host_permissions: linkedin-only",
    extraHosts.length === 0,
    extraHosts.length ? `unexpected: ${extraHosts.join(", ")}` : "",
  );

  const cs = manifest.content_scripts?.[0]?.matches ?? [];
  const matchesSet = new Set(cs);
  const extraMatches = [...matchesSet].filter(
    (m) => !ALLOWED_CONTENT_SCRIPT_MATCHES.has(m),
  );
  check(
    "content_scripts[0].matches: linkedin feed+profile only",
    extraMatches.length === 0,
    extraMatches.length ? `unexpected: ${extraMatches.join(", ")}` : "",
  );

  check(
    "background.service_worker present",
    typeof manifest.background?.service_worker === "string",
  );

  check(
    "side_panel.default_path present",
    typeof manifest.side_panel?.default_path === "string",
  );
} else {
  errors.push("dist/manifest.json missing — cannot verify contract");
}

if (errors.length > 0) {
  console.error(`\n[verify-build] FAILED — ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("\n[verify-build] PASS — build artefact respects capability lock.\n");
