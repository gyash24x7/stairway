# Stairway — Improvement Backlog

A prioritized set of improvements across robustness/architecture, new features, and UI/UX.
Grounded in the actual codebase (file:line references included). Ordered roughly by leverage,
with real security holes first.

> Status legend: 🔴 urgent · 🟠 high value · 🟡 polish

---

## 1. Robustness & architecture

### 🔴 Security holes — exploitable today by any logged-in user

Share a root cause: trusting client-supplied identity instead of `AuthContext`. Tackle as one PR.

- **WebSocket sync has zero auth.** `/sync/` is handled in `worker.ts` *before* `AuthMiddleware`,
  and `GameChannel.fetch` hands out whatever audience `?playerId=` names (`sync.ts:37-44`). Anyone
  who knows `game/gameId/playerId` gets that player's private snapshot stream forever.
  **Fix:** authenticate the WS upgrade — validate the session cookie and assert
  `session.userId === playerId` before attaching the socket to a `PlayerAudience`.
- **IDOR on `getState`/`getLog`.** Handlers pass the client-supplied `Audience` straight through
  with no `user.id === audience.id` check (`tictactoe/server/api.ts:84-87`). Any authed user can
  request `PlayerAudience(someoneElsesId)` and get their private view.
  **Fix:** derive the audience server-side from `AuthContext` + game membership; never trust the
  client's audience for private views.
- **No membership check on DO-addressed endpoints.** `addBots`/`start`/`getState` resolve
  `ns.getByName(gameId)` with no "is this user in this game?" gate (`api.ts:79-82`). Anyone can add
  bots to / start a stranger's game.
  **Fix:** add an `assertMember(user.id)` assertion in the engine used by all non-public commands.

### 🟠 Correctness under crash / concurrency

- **No transactionality across EventStore + GameStore** (`engine.ts:301-303`). `commitAndSave` does
  `log.append` → `save` → `broadcast` as independent writes. A crash between append and save
  permanently diverges the log from the snapshot, and `load()` never reconciles.
  **Fix:** (a) wrap the two writes in `ctx.storage.transaction(...)`, or (b) make `load()`
  self-healing — compare a stored `commitCount`/version against the log and `refold()` on mismatch.
  Option (b) also fixes reconnect-after-crash.
- **Optimistic concurrency & idempotency are client-driven and opt-in.** `expectedTurn` is only
  checked when the client sends it (`engine.ts:715`); omit it and stale moves land. Same for
  `requestId` dedup (`724`).
  **Fix:** always send both from the client (thread through `run()` in `client.ts`); consider a
  server-side monotonic version the engine bumps per commit.
- **Idempotency scan is O(all commits) and uses the full log, not cursor-bounded** (`engine.ts:725`)
  — inconsistent with `refold`/`getLog` which slice to `cursor+1`. After an undo, the redo tail
  still counts, so a re-submitted move can be wrongly deduped.
  **Fix:** keep a bounded `Set<requestId>` in the snapshot, or scan `commits.slice(0, cursor+1)`.
- **Concurrency story rests on an untested assumption** — DO input-gating (`engine.ts:722`). `append`
  is a multi-await read-modify-write and each command also awaits cross-DO calls (Sync, Scheduler).
  Needs tests to prove gating survives those awaits.

### 🟠 Biggest single gap: no tests exist at all

`package.json` has `"test": "bun test"` and zero test files. Highest-leverage investment — the
event-sourced design is unusually testable:

- **Deterministic replay tests** — a fixed event log folds to a fixed state. Golden-log tests per
  game catch reducer regressions instantly.
- **Engine command-path tests** with in-memory fakes for the four service tags
  (`GameStore`/`EventStore`/`Scheduler`/`Sync`) — no Cloudflare needed. Cover `submitMove` guards,
  undo/redo cursor math, capacity, idempotency.
- **Concurrency test** — fire N concurrent `submitMove`s at one engine instance; assert the log
  stays consistent. Validates the gating assumption above.
- **Bot self-play smoke tests** — run fish/callbreak bot-vs-bot to completion in a loop; also
  surfaces the splendor missing-`botMove` stall.

### 🟡 Smaller robustness items

- **Interaction/move timeouts are dead code** (`engine.ts:1004`) — a simultaneous/sequential window
  awaiting an unresponsive *human* stalls the game forever. Wire `move-timeout` to auto-pass/fold
  (also becomes the turn-clock feature).
- **Archival documented but unimplemented** — `submitMove`'s docstring says it archives completed
  games, but `resolveResults`/`CompletedGameData` are referenced nowhere. Completed games stay live
  in the DO forever; no standings record. Blocks history/stats/leaderboards.
- **Broadcast has no sequencing** — client blindly overwrites its cache per frame (`sync.ts:34`); a
  dropped/reordered frame leaves stale state with no resync, and reconnect doesn't replay the
  snapshot. **Fix:** add a version/seq to snapshots; client re-fetches `getState` on reconnect or
  version gap.
- Minor: `requireUserVerification: false` on both WebAuthn ceremonies; "rolling TTL" sessions never
  actually re-set KV expiry (`session.ts:36`); no rate limiting anywhere; errors thrown with
  `GameId.make("unknown")` discard the real id.

---

## 2. New features (roughly by leverage)

### Already ~80% built — just expose it

- **Spectator mode.** Server already redacts a `TableAudience`; sync already attaches table sockets
  (`sync.ts:38-40`). But `fish/context.tsx:26` and `callbreak/context.tsx:74` `return null` for any
  non-`PlayerView`, so spectators see a blank page. Add a spectator route + `TableView` render path.
- **Undo/redo in-game.** Engine fully implements cursor-based undo/redo (`engine.ts:878-911`) but no
  game exposes the endpoints. Great for casual/learning modes.
- **Action log / replay viewer.** `getLog` is implemented engine-side, unexposed. Event sourcing
  gives free full-game replay — scrub any finished game move-by-move. Standout feature; data exists.
- **Turn clocks.** `AlarmKind` has `move-timeout`; `InteractionFrame` has `deadline`; scheduler is
  ready. Add a per-game turn clock with auto-pass. Enables timed/blitz variants.

### Meatier features

- **Player profiles + game history + stats.** No game↔user join table and no history UI today. Add
  a `game_players` table + persist `CompletedGameData` on finish → "my games", per-game W/L,
  streaks. Unlocks everything below.
- **Leaderboards & ELO/rating** per game (needs archival + stats foundation).
- **Rematch** — one button on the completed screen to spin up a new game with same players/config.
  High-value, totally absent.
- **Bot difficulty selection.** Strong bots exist (fish = probabilistic card-tracker with signal
  detection; tictactoe = perfect minimax) but one fixed strength each. Expose easy/medium/hard via
  lookahead depth / confidence thresholds / added noise.
- **Fill bot gaps** — splendor has `addBots` but no `botMove` (seated bot stalls the game — live
  bug); kingdomino and wordle have none.
- **In-game chat / emotes / reactions.** None exists. Even lightweight emote reactions broadcast
  over the existing WS channel would make multiplayer feel alive.
- **Matchmaking / quick-play.** Today it's private-code-only. A quick-play queue or public open-
  tables lobby removes the "need a friend with a code" barrier.

### Delight layer

- **Sound.** Zero audio anywhere. Card flips, your-turn chime, win fanfare — big perceived-quality
  jump; framer-motion already does the visual half.
- **Your-turn browser notifications** when the tab is backgrounded (turn-based games are async).
- **Daily challenge** (wordle especially) — shared daily seed; RNG is already seeded/deterministic.

---

## 3. UI/UX improvements

### 🔴 Silent failure is the #1 UX problem

- **No error handling on any game move or state fetch.** Every game `useMutation`/`useQuery` omits
  `onError`/`isError` (zero across `src/games`). With `retry:false`, a rejected move just silently
  re-enables the button. `run()` unwraps the tagged domain error (`client.ts:37-45`) — UI never
  consumes it.
- **Toast system is fully wired but never mounted.** `sonner.tsx` exports a styled `Toaster` and
  `toast`, but `<Toaster>` is mounted nowhere and `toast()` is called nowhere.
  **Fix:** mount `<Toaster>` in `__root.tsx` + a shared mutation-error handler mapping tagged errors
  → toasts. Single change fixes the entire silent-failure class across all games.
- **Join-by-code fails silently.** `join-game.tsx` has an error state + red `<p>`, but `setError` is
  only ever called with `""` and the `joinGame` await isn't wrapped in try/catch (`:27`) — a bad
  code throws inside `startTransition`, is swallowed, no navigation, no message.
- **No error branch on game pages** — a bad `gameId`/non-member fetch leaves spinner-then-blank. Add
  an error state + "back to lobby" CTA.
- **No `notFoundComponent` / router error component** — a bad route spins forever.

### 🟠 Consistency & missing states

- **Turn indication is inconsistent.** Fish has an animated "YOUR TURN!" banner with contextual
  hints (`turn-indicator.tsx`); callbreak just thin-borders a tile; others vary. Promote fish's
  `TurnIndicator` into a shared component every multiplayer game uses.
- **No real lobby.** "Waiting for players" is a static spinner regardless of how many are missing —
  no "2 of 4 joined" progress, no ready-up, no leave/kick/host controls, no invite screen beyond the
  raw code. Build a shared lobby component.
- **No WS connection status.** Silent auto-reconnect makes a dropped socket look like a frozen
  board. Add a "reconnecting…" indicator + refetch-on-reconnect (ties to sync-versioning fix).
- **Dead UX code in wordle** — `invalidGuess` is threaded through context but never set to `true`,
  so the invalid-word shake never fires (`context.tsx:43`). Wire it up (needs the error surface).
- **No empty states** — `ActivityFeed` returns `null` when empty; lobbies show a generic spinner. No
  skeletons anywhere, only spinners.

### 🟡 Polish & a11y

- **Home cards** are `cursor-pointer` on the whole tile but only the inner button is a real,
  focusable link — misleading affordance + a11y gap. Make the whole card a focusable link.
- **Unauthenticated `$gameId`** shows flat "Please log in to play." with no login button — dead end.
  Add the login CTA there.
- **A11y nits:** empty `<DrawerDescription/>` on move drawers, `alt=""` on player avatars, global
  unscoped wordle keydown listener.
- **Login is modal-only** — no `/login` route to deep-link or redirect to.
- **No optimistic UI** anywhere — even a lightweight optimistic tile-reveal (wordle) or card-play
  would cut perceived latency.

---

## Suggested starting sequence

1. **Security PR** — WS auth + IDOR + membership checks (live leaks).
2. **Mount `<Toaster>` + shared mutation-error handler** — small change, kills the entire
   silent-failure class, makes the app feel trustworthy. (~couple hours.)
3. **First tests** — deterministic replay + engine command path. Cheap given the architecture;
   de-risks everything after.
4. **Expose spectator + replay + rematch** — high wow-factor, mostly already built.
5. **Stats/history foundation** — unlocks leaderboards/ELO.
