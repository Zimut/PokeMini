# Battle arena floor graphic

Drop a single PNG here as the platform / floor graphic for the battle screen. The same image is used for both sides (player at the bottom and opponent at the top).

## Required file

| File | Notes |
|---|---|
| `player.png` | Used for **both** the player and the opponent side |

## Recommended specs

- **Format:** PNG (transparent background recommended).
- **Resolution:** **400 × 260 px** (matches the 3×2 slot grid: 384 × 252 px + a small bleed).
   - 800 × 520 for hi-DPI sharpness — the browser downscales cleanly.
- **Aspect ratio:** roughly **1.54 : 1** (wide and shallow, like a stage / floor).
- **Composition:** keep the focal content centered. The graphic is rendered with `background-size: contain`, centered, behind the 6 battle slots.
- **Rendering:** pixel-perfect (`image-rendering: pixelated`) — Game-Boy / Gen-1 pixel art will look crisp at the displayed size.
- **Opacity:** the floor is rendered at **70% opacity** so the sprites stay the focal point.
