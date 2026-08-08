import type { PlayerId, Standing, Standings } from "@/shared/swish/schema.ts";

/**
 * The per-seat inputs `makeStandings` needs from a game: how two seats compare
 * (best-first, exactly like an `Array#sort` comparator) and the optional `score`
 * and `team` labels carried into each `Standing`.
 */
export type StandingsSpec = {
	/** The roster, in seating order. Ties keep this order, so it must be stable. */
	readonly players: ReadonlyArray<PlayerId>;

	/**
	 * Orders two seats best-first: negative when `a` outranks `b`, positive when
	 * `b` outranks `a`, and zero when they are level (a shared placement).
	 */
	readonly compare: ( a: PlayerId, b: PlayerId ) => number;

	/** The seat's final score, shown alongside its placement. Omit for scoreless games. */
	readonly score?: ( id: PlayerId ) => number | undefined;

	/** The seat's team label, for team games (fish). Omit for free-for-alls. */
	readonly team?: ( id: PlayerId ) => string | undefined;

	/**
	 * How a tie consumes the ranks it spans. `"competition"` (the default) is the
	 * sporting convention — two seats tied for first are both 1st and the next is
	 * 3rd. `"dense"` never skips, so the next placement group is always the next
	 * number; that is what a *team* game wants, where a tie is not an accident but
	 * the whole team, and the losing team of three should place 2nd, not 4th.
	 */
	readonly ties?: "competition" | "dense";
};

/**
 * Builds a game's canonical {@link Standings} from a seat comparator — the one
 * place the rank/tie/winner rules live, so no game re-derives them.
 *
 * Seats that compare equal always share a rank; `ties` decides whether the next
 * placement skips the seats they tie with (1, 2, 2, 4) or not (1, 2, 2, 3).
 * `winner` is an *outright* winner only — it is left unset when the top two seats
 * are level, which is exactly a draw (tic-tac-toe) or a shared victory (the
 * kingdomino rulebook's full-tie case).
 *
 * @param spec - The roster, comparator, and optional score/team/tie settings.
 * @returns The final ranking, best-first, plus the outright winner when there is one.
 */
export const makeStandings = ( spec: StandingsSpec ) => {
	// `toSorted` is stable, so seats level on every key stay in seating order.
	const ordered = spec.players.toSorted( spec.compare );

	const ranking: Array<Standing> = [];
	let rank = 0;
	for ( let i = 0; i < ordered.length; i++ ) {
		const id = ordered[ i ]!;
		const previous = ordered[ i - 1 ];

		// Level with the seat above → share its rank; otherwise take the next one.
		rank = previous !== undefined && spec.compare( previous, id ) === 0
			? rank
			: spec.ties === "dense" ? rank + 1 : i + 1;

		ranking.push( {
			playerId: id,
			rank,
			score: spec.score?.( id ),
			team: spec.team?.( id )
		} );
	}

	const [ first, second ] = ordered;
	const outright = first !== undefined
		&& ( second === undefined || spec.compare( first, second ) !== 0 );

	const standings: Standings = { ranking, winner: outright ? first : undefined };
	return standings;
};
