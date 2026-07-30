/**
 * The single source of truth for the set of games. Anything that needs the
 * *list of game names* — the SPA landing grid, the typed client — derives it
 * from here. Keys are canonical and match each game's route prefix and its
 * `HttpApiGroup` name (e.g. `tictactoe`, never `tic-tac-toe`/`ticTacToe`).
 *
 * The API composition (`contract/api.ts`) and the worker's Durable Object
 * wiring reference the per-game groups/engines directly — Effect layers are
 * structural and can't be spread from a name list — but the set of names lives
 * only here. To hide an in-progress game from the SPA, remove it from this list.
 */
export const GAME_NAMES = [
	"fish",
	"callbreak",
	"wordle",
	"tictactoe",
	"splendor",
	"kingdomino"
] as const;

export type GameName = typeof GAME_NAMES[ number ];
