# client/

Browser frontend. Plain HTML/CSS/JS — no framework.

- `index.html` is the only HTML file. Phases swap by toggling container visibility.
- `src/data/` holds bundled JSON (stats, types, abilities, zones). These are static and shipped with the build.
- `src/engine/` holds the battle simulator. **It must run unchanged in Node** so the server can replay battles. No DOM references.
- `src/phases/` holds one module per phase: `starter.js`, `adventure.js`, `pvp.js`, `town.js`.
- `src/ui/` holds HUD, tooltips, drag-and-drop helpers.
- `src/net/` holds the thin fetch client for `/run/*`, `/pvp/*`, `/shop/*` endpoints.
- `styles/` is hand-written CSS. Stick to the Wii-inspired palette declared in `styles/tokens.css`.

**Hard rules**
- No emojis anywhere. No tutorial text. Titles only; explanations live in tooltips.
- No external runtime dependencies beyond the sprite CDN.
- Initial JS payload < 200 KB minified.

If you need to load anything from a CDN, list it in `assets/INSTRUCTIONS.md` first.
