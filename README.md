# grip-post

*A LinkedIn tool that refuses to write fluff.*

## What it is

A Chrome extension that helps you write better LinkedIn posts: Unicode formatting + a gate that refuses to write fluff.

## Why

- LinkedIn's native editor strips most Unicode formatting. grip-post applies it via a side panel so it survives copy-paste.
- Most AI writing tools produce the same hollow phrases. grip-post flags them before you publish.
- You get seven Unicode transforms free. The AI closer rewriter is Pro ($4/mo, early access — ships in v0.3).

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

## Pro tier (early access)

$4/mo subscription unlocks the AI closer rewriter + R0 grounding semantic check + reason-out-loud. The rewriter itself ships in v0.3 — routes through HAL (Harness Abstraction Layer, CodeTonight's proprietary inference router) with an anti-fluff floor BEFORE the LLM call so banned phrases never reach the model. Subscribing now locks the early-bird price and funds the build.

Buy: [polar.sh/architext1/grip-post-pro](https://polar.sh/architext1/grip-post-pro)

## Claude Code plugin (terminal)

grip-post is also a [Claude Code](https://claude.com/claude-code) plugin. The
same `src/lib` core that powers the Chrome side panel runs in your terminal — one
core, two surfaces, identical behaviour.

**Install** (inside Claude Code):

```
/plugin marketplace add CodeTonight-SA/grip-post
/plugin install grip-post@grip-post
```

Requires Node ≥ 20 — the command runs the core via `npx tsx` (fetched on first use).

**Use**:

```
/grip-post check        We are thrilled to announce…   -> DENY: "thrilled to announce"
/grip-post bold         Hiring three engineers          -> 𝗛𝗶𝗿𝗶𝗻𝗴 𝘁𝗵𝗿𝗲𝗲 𝗲𝗻𝗴𝗶𝗻𝗲𝗲𝗿𝘀
/grip-post italic       a quiet aside                   -> 𝘢 𝘲𝘶𝘪𝘦𝘵 𝘢𝘴𝘪𝘥𝘦
/grip-post strip-tells  <your draft>                    -> removes AI tells
```

No plugin system? Run the CLI directly:
`npx tsx bin/grip-post.ts check --file draft.txt`.

Full command reference + verdict semantics:
[docs/CLAUDE_CODE_PLUGIN.md](docs/CLAUDE_CODE_PLUGIN.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the open issues for the current roadmap.
