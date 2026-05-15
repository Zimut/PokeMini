# assets/

This folder holds **manifests and small metadata**, not binary art. Sprites and icons load from public CDNs at runtime.

## Pokémon sprites

Pull from the PokéAPI sprites repository:

```
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/{id}.png
```

Front sprites are used on enemy side, back sprites on player side. Gen 1 IDs are 1–151.

## Item icons

Use a public Gen 1 item icon set. Recommended:

```
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/{slug}.png
```

Map our item names to slugs in `assets/item-manifest.json` (build agent to create):
- Evosoda → `rare-candy`
- Revive → `revive`
- Repel → `repel`
- Great Ball → `great-ball`
- TM → `tm-normal` (or any generic TM icon)
- HM → `hm-normal`
- Trade Card → `link-cable` (closest in-set option)

## Type icons

Either bake into CSS via colored chips, or pull from the same sprite repo's `types/` folder. The CSS chip approach is lighter; prefer it.

## Caching

Cache headers on the CDN are already generous. Do not proxy these through our server.

## Do not

- Do not check sprite binaries into this repo.
- Do not host or rehost copyrighted art.
- Do not use sprites from generations other than Gen 1 in v0.
