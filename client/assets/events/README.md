# Adventure event images

Drop a PNG file here for each event type. The card image area is roughly 200×150 px on a typical desktop and scales smoothly thanks to `image-rendering: auto`, so a higher-resolution source looks best.

## Required files

| Event | Filename | Notes |
|---|---|---|
| Wild Pokémon Encounter | `wild.png` | A silhouette / "?" / wild grass scene |
| Berry Gathering | `berry.png` | A berry / berry bush |
| Trading | `trade.png` | Trade icon / cable / two arrows |
| PokéCenter | `pokeCenter.png` | Red cross / healing icon |
| Part-Time Job | `job.png` | Money / coin / brief case |
| Daycare | `daycare.png` | Egg / baby Pokémon / playpen |

(Trainer Battle uses the trainer's actual sprite from PokéAPI dynamically and isn't customised here.)

## Recommended specs

- **Format:** PNG or JPG.
- **Resolution:** **400 × 180 px** (matches the card's image-area aspect ratio).
   - 800 × 360 for hi-DPI sharpness — file size grows but the visual is identical because the browser bilinear-downscales.
- **Aspect ratio:** wide landscape (roughly **2.2 : 1**). The image is rendered with `object-fit: cover` and fills the card-image area edge-to-edge.
   - Different aspect ratios are cropped (the center stays, edges get clipped) — not stretched, so the art never distorts.

The card itself is **180 px tall** and rectangular. Trainer Battle is the same height; its `trainer.png` already follows the cover-fill behavior.

## Fallback behavior

If a file is missing, the card falls back to the PokéAPI item icon it was using before (poke-ball, oran-berry, link-cable, super-potion, amulet-coin, lucky-egg) so the game stays playable while you're filling these in.
