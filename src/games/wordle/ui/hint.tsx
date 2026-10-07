import type { WordleHint } from "@/games/wordle/schema";
import { hintAtom } from "@/games/wordle/ui/client";
import { GameId } from "@/swish/schema";
import { HintButton, NO_HINT, useHint } from "@/swish/ui/hint";


export const describeHint = ( { move }: WordleHint ) => {
	if ( !move ) {
		return NO_HINT;
	}

	// A guess the policy offers is not always one of the answers — with spare
	// guesses it will spend one on a word chosen to split the candidates rather
	// than to be right. Saying "TRY" rather than "THE WORD IS" is the difference,
	// and it is the honest wording for both cases.
	return move.moveType === "guess"
		? `TRY ${ move.input.guess.toUpperCase() }`
		: "THERE IS NOTHING LEFT TO TRY — GIVE UP";
};

export type WordleHintProps = {
	readonly gameId: string;
	readonly disabled?: boolean;
};

export function WordleHint( { gameId, disabled }: WordleHintProps ) {
	const request = { params: { gameId: GameId.make( gameId ) } };
	return <HintButton { ...useHint( hintAtom, request, describeHint ) } disabled={ disabled }/>;
}
