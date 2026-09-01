import * as Schema from "effect/Schema";

import { GameCode, GameId, PositiveInt } from "@/swish/shared/schema.ts";

/**
 * The most tables one listing answers with.
 *
 * A cap rather than pagination, because an open table is a short-lived thing: it
 * exists between somebody creating it and its last seat filling, so the set is
 * naturally small and a second page would mostly hold tables that had already
 * gone by the time anyone asked for it.
 */
export const OPEN_TABLE_LIMIT = 50;

/**
 * How old a table may be and still be offered.
 *
 * Nothing ever closes a table that was created and then abandoned: the sweeper
 * only touches finished games, so a `CREATED` row with nobody at it survives
 * indefinitely. Without a floor the lobby would fill with tables whose creators
 * left months ago, and the newest ones — the only ones anybody can actually join
 * — would be the hardest to find.
 */
export const OPEN_TABLE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * One table somebody could sit down at.
 *
 * The code travels with it, which is what lets a discovered table be joined
 * through the join endpoint every game already has rather than needing a
 * join-by-id beside it. That is not a leak: a listed table is one whose
 * existence is deliberately being advertised, and the code is the only thing
 * anybody needs in order to accept the invitation.
 *
 * `seatsTaken` counts bots as well as people. It is replicated from the game's
 * own record precisely because the relational store cannot see a bot, and a
 * table three-quarters filled by machines has to read as nearly full rather than
 * nearly empty.
 *
 * `createdAt` is epoch milliseconds rather than a date, matching the other
 * instants that cross this boundary, so a client can render how long a table has
 * been waiting without parsing anything first.
 */
export type OpenTable = typeof OpenTable.Type;
export const OpenTable = Schema.Struct( {
	id: GameId,
	code: GameCode,
	game: Schema.NonEmptyString,
	seatsTaken: PositiveInt,
	playerCount: PositiveInt,
	createdAt: PositiveInt
} );

/**
 * What a caller may ask the listing for.
 *
 * `status` is a one-member literal rather than a lifecycle-status filter,
 * because "open" is the lobby's question and not a status: it means joinable
 * *and* still has room, which is two facts about a row and neither of them is
 * the status by itself. Keeping it a literal leaves room for another lobby word
 * later without it ever having meant "any status you like".
 *
 * `game` narrows to one kind, which is the common case rather than the rare one
 * — every route in the app is already per-game.
 */
export type OpenTableQuery = typeof OpenTableQuery.Type;
export const OpenTableQuery = Schema.Struct( {
	status: Schema.Literals( [ "open" ] ),
	game: Schema.optionalKey( Schema.NonEmptyString )
} );
