import {
	applyPlacement,
	calculateScore,
	largestProperty
} from "@/games/kingdomino/server/utils.ts";
import { coordKey, getValidPlacements } from "@/games/kingdomino/shared/utils.ts";

import type { KingdominoView, Placement, PlayerData } from "@/games/kingdomino/shared/schema.ts";
import type { GameContext } from "@/swish/shared/schema.ts";

/**
 * What a kingdom would be worth with this domino laid: its points first, then
 * the size of its largest property. The second key is what gives the bot
 * something to prefer early on, when nothing it can lay scores anything yet —
 * it grows one big territory instead of scattering.
 *
 * @param me - The seat's holdings.
 * @param placement - The placement being weighed.
 * @returns The two keys, best-highest.
 */
const valueOf = ( me: PlayerData, placement: Placement ) => {
	const score = calculateScore( applyPlacement( me.board, placement ) );
	return { points: score.points, largest: largestProperty( score ) };
};

/**
 * A greedy Kingdomino policy: claim the most crowned domino still on offer, and
 * lay the one it is holding wherever the kingdom ends up worth most.
 *
 * It sees the seat's own view and nothing more, which for this game is the whole
 * table bar the order of the undrawn deck — so it plays with exactly the
 * information the player it stands in for would have.
 *
 * The engine dies on an illegal move from a policy, so every branch builds a
 * move the rules already accept rather than one `validate` has to catch: a claim
 * is only ever an unclaimed entry, a placement comes out of `getValidPlacements`,
 * and the domino named is always the lowest in the queue — which is the one the
 * rules make it lay next. Discarding is reached only when that domino has no
 * legal placement at all, which is exactly when discarding is allowed.
 *
 * @param view - The acting seat's view of the table.
 * @param context - The engine's context, which is where the phase lives.
 * @returns The move to play, or `undefined` when the seat has nothing to do.
 */
export const decideMove = ( view: KingdominoView, context: GameContext ) => {
	const me = view.playerId ? view.playerData[ view.playerId ] : undefined;
	if ( !me ) {
		return undefined;
	}

	// Claiming: take the most crowns going, and settle ties on the low domino —
	// a weak tile bought with an early pick next round.
	if ( context.phase !== "PLACE" ) {
		const [ pick ] = view.draft
			.filter( entry => !entry.selectedBy )
			.toSorted( ( a, b ) => {
				const byCrowns = ( b.domino.left.crowns + b.domino.right.crowns )
					- ( a.domino.left.crowns + a.domino.right.crowns );

				return byCrowns !== 0 ? byCrowns : a.domino.id - b.domino.id;
			} );

		return pick
			? { moveType: "selectDomino" as const, input: { dominoId: pick.domino.id } }
			: undefined;
	}

	// Laying: the rules fix which domino — the lowest still in the queue — so the
	// only choice is where.
	if ( me.queue.length === 0 ) {
		return undefined;
	}

	const dominoId = Math.min( ...me.queue );
	const [ best ] = getValidPlacements( me.board, dominoId )
		.map( placement => ( { placement, value: valueOf( me, placement ) } ) )
		.sort( ( a, b ) => ( b.value.points - a.value.points )
			|| ( b.value.largest - a.value.largest )
			// Ordered by cell and then by turn so two runs of the same game make the
			// same choice: the policy has to be as deterministic as the log it commits to.
			|| coordKey( a.placement.coord ).localeCompare( coordKey( b.placement.coord ) )
			|| ( a.placement.rotation - b.placement.rotation ) );

	return best
		? { moveType: "placeDomino" as const, input: { placement: best.placement } }
		: { moveType: "discardDomino" as const, input: { dominoId } };
};
