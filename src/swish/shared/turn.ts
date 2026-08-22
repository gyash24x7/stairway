import type { GameContext } from "@/swish/shared/schema.ts";

/**
 * Who the game is waiting on: the next responder yet to answer while an
 * interaction is open, otherwise the current player.
 *
 * Lives here rather than inside the engine because two places need the same
 * answer and they must not be allowed to drift. The engine uses it to decide
 * whose move to accept and when to arm a turn timer; the host uses it to decide
 * who to notify when a turn changes hands. A second, host-local reimplementation
 * would look right and quietly disagree the moment interactions are involved.
 *
 * Takes the context rather than the whole record so it stays usable from the
 * published view, which carries a `GameContext` in its header but no state.
 *
 * @param context - The turn context to inspect.
 * @returns The player expected to act, if there is one.
 */
export const pendingActor = ( context: GameContext ) => {
	if ( context.interactions.length > 0 ) {
		const [ active ] = context.interactions.slice( -1 );
		return active.responders.find( ( id ) => !( id in active.responses ) );
	}

	return context.currentPlayer;
};
