# grip-post

*A LinkedIn tool that refuses to write fluff.*

## What it is

A Chrome extension that helps you write better LinkedIn posts: Unicode formatting + a gate that refuses to write fluff.

## Why

- LinkedIn's native editor strips most Unicode formatting. grip-post applies it via a side panel so it survives copy-paste.
- Most AI writing tools produce the same hollow phrases. grip-post flags them before you publish.
- You get seven Unicode transforms free. The AI closer rewriter and R0 grounding check are Pro ($9 one-time or $4/mo).

## Install

**Chrome Web Store**: coming W11 (June 2026).

**Dev build** (load unpacked):

```
git clone https://github.com/CodeTonight-SA/grip-post.git
cd grip-post
npm install
npm run build
```

Then open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select the `dist/` folder.

**Package** (produces `grip-post-<version>.zip` for Chrome Web Store upload):

```
npm run package
```

Runs `build` → `verify-build` (capability-lock assertion on the artefact's permissions + host_permissions + content-script matches) → zips `dist/`. Fails loud if the build widened the permission surface.

## Pro tier

$9 one-time OR $4/mo unlocks the AI closer rewriter + R0 grounding check + reason-out-loud.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the open issues for the current roadmap.
