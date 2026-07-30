import { type Audience, type PlayerId } from "@/shared/swish/schema.ts";

/**
 * Builds a game's audience-dispatching `view` from two projections. A `Player`
 * audience gets the private projection (its own slice, keyed by id); the `Table`
 * audience gets the public projection. Each projection returns its own tagged
 * view struct (e.g. `WordlePlayerView.make(...)` / `WordleTableView.make(...)`),
 * so the resulting `view` is a discriminated union `P | T` — the private slice is
 * REQUIRED inside the player variant, and clients narrow once on `_tag` instead of
 * null-checking every private field.
 *
 * @param projections - `table(data)` and `player(data, id)` projections.
 * @returns The `(data, audience) => view` function `makeEngine` expects.
 */
export const defineView = <Data, P, T>( projections: {
	readonly table: ( data: Data ) => T;
	readonly player: ( data: Data, id: PlayerId ) => P;
} ) => ( data: Data, audience: Audience ) =>
	audience._tag === "swish/Player"
		? projections.player( data, audience.id )
		: projections.table( data );
