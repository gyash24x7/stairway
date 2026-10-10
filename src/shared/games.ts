/**
 * Every game with a route registered in `src/main.tsx`, in the order the arena
 * offers them.
 *
 * This is the one list of games the UI reads: the landing page draws a tile for
 * each, and the world builds a room for each, so a game joins both by being
 * added here. An entry with no routes behind it lands on the router's error
 * element, which is why a game is added here only once its UI exists.
 */
export const GAME_NAMES = [
	"fish",
	"callbreak",
	"coup",
	"wordle",
	"tictactoe",
	"splendor",
	"kingdomino"
] as const;

export type GameName = typeof GAME_NAMES[ number ];

export type GameMeta = {
	/** The name as the game's own pages print it. */
	readonly title: string;
	/** One line, for places with no room for the home page's blurb. */
	readonly tagline: string;
};

export const GAMES: Record<GameName, GameMeta> = {
	fish: { title: "FISH", tagline: "Two teams ask for cards until every half-suit is claimed." },
	callbreak: {
		title: "CALLBREAK",
		tagline: "Call your tricks, then make them — spades are trump."
	},
	coup: { title: "COUP", tagline: "Bluff your way to being the last influence standing." },
	wordle: { title: "WORDLE", tagline: "Six guesses to find the five-letter word." },
	tictactoe: { title: "TIC TAC TOE", tagline: "Three in a row, the classic way." },
	splendor: { title: "SPLENDOR", tagline: "Collect gems, buy developments, court the nobles." },
	kingdomino: {
		title: "KINGDOMINO",
		tagline: "Draft dominoes into the richest five-by-five kingdom."
	}
};

export const isGameName = ( value: string ): value is GameName =>
	( GAME_NAMES as ReadonlyArray<string> ).includes( value );
