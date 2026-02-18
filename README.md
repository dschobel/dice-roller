# 3D Dice Roller PWA

Single-die 3D roller built for touch devices (including iPad) with:

- `three` for rendering
- `cannon-es` for dice physics
- PWA install support via `manifest.json` + service worker

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy notes

- GitHub Pages subpath hosting is supported (`vite.config.js` uses `base: "./"`).
- Root `index.html` is also self-contained for static hosting and uses local `vendor/` modules.

## iPad usage

1. Open the deployed app in Safari.
2. Use **Share -> Add to Home Screen** to install.
3. Launch from the home screen for standalone fullscreen behavior.
