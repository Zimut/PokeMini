# server/

Node.js + Fastify + SQLite (`better-sqlite3`). Single process, stateless except DB.

- `src/index.ts` boots Fastify and registers routes.
- `src/routes/` contains one file per endpoint:
  - `run.ts` — `/run/start`, `/run/advance`
  - `pvp.ts` — `/pvp/match`, `/pvp/result`
  - `shop.ts` — `/shop/town`
- `src/matchmaking.ts` selects opponent snapshots by `(zone, badges, strikes, elo_bucket)`. Falls back to a generated ghost team if no snapshot exists within 24h.
- `src/replay.ts` imports the client battle engine and replays the submitted log/seed to validate before applying ELO and badges.
- `src/elo.ts` implements the table in `GDD.md §10`.

**Hard rules**
- Server is the authority. Never trust client-submitted ELO, money, or badge deltas.
- All endpoints are `POST` with a JSON body.
- All RNG must use the shared seeded RNG; the client and server must agree.
- Response time budget: p99 < 50 ms under expected load.
- Do not introduce Redis, WebSockets, or a message queue in v0.
