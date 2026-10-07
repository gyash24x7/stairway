import type { CallbreakHint } from "@/games/callbreak/schema";
import { hintAtom } from "@/games/callbreak/ui/client";
import { getCardDisplayString } from "@/shared/utils/cards";
import { GameId } from "@/swish/schema";
import { HintButton, NO_HINT, useHint } from "@/swish/ui/hint";


export const describeHint = ( { move }: CallbreakHint ) => {
	if ( !move ) {
		return NO_HINT;
	}

	return move.moveType === "declareWins"
		? `DECLARE ${ move.input.wins }`
		: `PLAY THE ${ getCardDisplayString( move.input.cardId ) }`;
};

export type CallbreakHintProps = {
	readonly gameId: string;
	readonly disabled?: boolean;
};

export function CallbreakHint( { gameId, disabled }: CallbreakHintProps ) {
	const request = { params: { gameId: GameId.make( gameId ) } };
	return <HintButton { ...useHint( hintAtom, request, describeHint ) } disabled={ disabled }/>;
}
