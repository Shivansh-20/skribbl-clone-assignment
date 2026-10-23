# Skribbl — multiplayer drawing and guessing game

**Live URL:** *(added in Phase 6)*  
**Deadline:** end of Sunday 25 October

---

## Quick start

```bash
# Terminal 1 — server (hot-reloads on save)
cd server
npm install
npm run dev

# Terminal 2 — client
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. Open a second tab. Both tabs should show "connected ✅" with different socket IDs.

## Phase progress

- [x] Phase 0 — setup, ping-pong connection check
- [x] Phase 1 — rooms and lobby
- [x] Phase 2 — real-time drawing
- [ ] Phase 3 — game loop (turns, timer, word)
- [ ] Phase 4 — guessing, scoring, game over
- [ ] Phase 5 — polish and disconnects
- [ ] Phase 6 — deployment and README

## Tech stack

| Part | Choice |
|---|---|
| Frontend | React 18 + Vite (plain JavaScript) |
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Words | Local JSON file |
| Deployment | Render (one service, one URL) |

## Architecture overview

*(filled in Phase 6)*

## Known limitations

*(filled in Phase 6)*
