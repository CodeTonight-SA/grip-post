# grip-post in Safari

Same Unicode transforms, same anti-fluff gate, same `src/lib` core. Two ways to
run it in Safari — pick by whether you have Xcode.

## 1. Test-drive now — zero install, any browser

```
npm install
npm run dev:web
```

Open the printed `localhost` URL in Safari. The side-panel UI runs as an
ordinary web page: paste a draft, pick a transform, copy the result into
LinkedIn. The anti-fluff `check` / `strip-tells` / `ground-check` gates all run.

In this mode drafts and usage stats are **in-memory only** (no `chrome.storage`),
so they reset when you close the tab — that is the one difference from the
installed extension. Everything else is the real code.

Build a static bundle instead of the dev server with `npm run build:web`
(output in `dist-web/`).

## 2. Full Safari extension — toolbar popup, context menus, persistent storage

Safari Web Extensions must be built into an app bundle by **full Xcode** —
unlike Chrome, there is no "load unpacked" folder, and the Command Line Tools
alone cannot build one.

```
# one-time — install Xcode from the App Store, then point xcrun at it:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

npm run package:safari
```

`package:safari` builds the Safari target (`dist-safari/`) and runs
`safari-web-extension-converter` to generate an Xcode project. Then:

1. Open the generated `.xcodeproj` and Build (Cmd-B).
2. Safari -> Settings -> Extensions -> enable **grip-post**.
   For an unsigned dev build, first enable **Develop -> Allow Unsigned
   Extensions** (the Develop menu is under Safari -> Settings -> Advanced ->
   "Show features for web developers").

## Why a popup instead of a side panel?

Chrome has a native side panel (`chrome.sidePanel`); Safari does not. Rather than
fork the UI, the Safari target gives the toolbar button a `default_popup`
pointing at the **same `sidepanel.html`** the Chrome side panel uses. One UI,
one core, two surfaces.

The only difference between the Chrome and Safari builds is that one manifest
key — see `src/manifest-targets.ts` (`toSafariManifest`), which is unit-tested in
`tests/manifest-safari.test.ts` so the two targets cannot silently diverge.

## Build targets

| Command | Target | Output | Load via |
|---|---|---|---|
| `npm run build` | Chrome MV3 + side panel | `dist/` | `chrome://extensions` -> Load unpacked |
| `npm run build:safari` | Safari MV3 + popup | `dist-safari/` | `npm run package:safari` -> Xcode |
| `npm run dev:web` / `build:web` | Plain web page | dev server / `dist-web/` | Open in any browser |
