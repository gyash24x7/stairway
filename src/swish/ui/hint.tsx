import * as Exit from "effect/Exit";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import type * as Atom from "effect/reactivity/Atom";

import { Button } from "@/shared/primitives/button";
import { toast } from "@/shared/primitives/sonner";
import { Spinner } from "@/shared/primitives/spinner";
import { causeMessage } from "@/shared/shell/errors";
import type { GameRef } from "@/swish/schema";

/** What a game says when its policy declined to suggest anything. */
export const NO_HINT = "NO SUGGESTION RIGHT NOW";

export type HintButtonProps = {
	hinting: boolean;
	askHint: () => void;
	disabled?: boolean;
};

/**
 * Ask the game what to play.
 *
 * `neutral` for the same reason `AutoPlayToggle` is: this sits in the bar the
 * moves themselves are made from, and an accent button there would compete with
 * the move the seat is actually being asked to make. It is help, not a play.
 */
export function HintButton( { hinting, askHint, disabled }: HintButtonProps ) {
	return (
		<Button variant={ "neutral" } onClick={ askHint } disabled={ hinting || disabled }>
			{ hinting ? <Spinner/> : "HINT" }
		</Button>
	);
}

/**
 * Says a settled hint request out loud.
 *
 * A toast rather than anything the page holds on to, because a hint is about the
 * position *now*: the table moves on, and a suggestion left on screen would go
 * on recommending a move that is no longer available. Letting it expire is the
 * behaviour, not a shortcut.
 *
 * Refusals come through here too, which is what makes the button safe to leave
 * enabled on a position the client read a moment ago — a hint asked a beat after
 * somebody else moved says "it's not your turn yet" rather than misleading.
 *
 * @param exit - How the request settled.
 * @param describe - The game's own wording for a suggestion it recognises.
 */
export const toastHint = <A, >( exit: Exit.Exit<A, unknown>, describe: ( hint: A ) => string ) => {
	if ( Exit.isFailure( exit ) ) {
		toast.error( causeMessage( exit.cause ) );
		return;
	}

	toast( describe( exit.value ) );
};


/**
 * What every hint atom is asked for: the table, and nothing else.
 *
 * The endpoint is engine-owned and takes no payload — the seat it answers about
 * is the authenticated identity — so this is the whole request for all seven
 * games.
 */
export type HintRequest = { readonly params: GameRef };

/**
 * Wires a game's hint atom to a button.
 *
 * The seven games differ in a single thing — how a suggestion is put into words
 * — so `describe` is the only argument carrying any of the game in it. The rest
 * is identical everywhere and belongs here rather than copied seven times.
 *
 * `request` is passed in rather than built from a game id so that `Arg` is
 * inferred from the atom and the call site is checked against it. The generated
 * client's request type carries optional fields of its own, and a helper that
 * built the object itself could only satisfy them by asserting.
 *
 * @param hintAtom - The game's `hint` mutation atom.
 * @param request - The table to ask about.
 * @param describe - The game's wording for a suggestion.
 * @returns Props for {@link HintButton}, less `disabled`.
 */
export const useHint = <Arg extends HintRequest, A, E>(
	hintAtom: Atom.AtomResultFn<Arg, A, E>,
	request: Arg,
	describe: ( hint: A ) => string
) => {
	const ask = useAtomSet( hintAtom, { mode: "promiseExit" } );
	const hinting = useAtomValue( hintAtom ).waiting;

	return {
		hinting,
		askHint: () => void ask( request ).then( exit => toastHint( exit, describe ) )
	};
};
