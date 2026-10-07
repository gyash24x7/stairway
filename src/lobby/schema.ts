import * as Schema from "effect/Schema";

import { GameId, PlayerInfo, PositiveInt } from "@/swish/schema";


/**
 * One table still looking for players, as the lobby offers it.
 *
 * - game: Which game it is, and the first segment of its join link
 * - gameId: Id of the game
 * - playerCount: How many seats the table has
 * - seated: How many are taken
 * - players: Who is already there, in joining order
 * - createdAt: When the table was opened, as an absolute instant
 *
 * `seated` is sent alongside `players` rather than left to be counted off it,
 * because the two are allowed to disagree: a caller renders "2/4" from these
 * numbers, and a future lobby that stops sending a long roster should not have
 * to change what the count means.
 *
 * Bots count. `addBots` writes a seat like any other join, and a table with
 * three bots in it has one seat left however it got that way — a joiner reading
 * "3/4" and finding the table full would be the alternative.
 *
 * This is deliberately not a `GameView`. A view is a game's own shape, redacted
 * for an audience, and every game's is different; the lobby is one list across
 * seven games and can only carry what they have in common. Nothing here is
 * private: it is the table's own advertisement.
 */
export type OpenTable = typeof OpenTable.Type;
export const OpenTable = Schema.Struct( {
	game: Schema.NonEmptyString,
	gameId: GameId,
	playerCount: PositiveInt,
	seated: PositiveInt,
	players: Schema.Array( PlayerInfo ),
	createdAt: Schema.Number
} );

/**
 * What the lobby is being asked for.
 * - game: Narrows the list to one game. Absent means every game, which is what
 * 		the cross-game `/tables` page asks for
 */
export type OpenTablesQuery = typeof OpenTablesQuery.Type;
export const OpenTablesQuery = Schema.Struct( {
	game: Schema.optional( Schema.NonEmptyString )
} );
