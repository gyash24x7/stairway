import type { FishConfig, FishHint, FishView } from "@/games/fish/schema";
import { hintAtom } from "@/games/fish/ui/client";
import { bookOfClaim, getBookDisplayString } from "@/games/fish/utils";
import { getCardDisplayString } from "@/shared/utils/cards";
import type { GameView, PlayerId } from "@/swish/schema";
import { GameId } from "@/swish/schema";
import { HintButton, NO_HINT, useHint } from "@/swish/ui/hint";


export const describeHint = (
	{ move }: FishHint,
	game: GameView<FishView, FishConfig>
) => {
	if ( !move ) {
		return NO_HINT;
	}

	const nameOf = ( playerId: PlayerId ) => game.players[ playerId ]?.name ?? "THEM";

	switch ( move.moveType ) {
		case "askCard":
			return `ASK ${ nameOf( move.input.from ) } FOR THE ${ getCardDisplayString( move.input.cardId ) }`;

		case "claimBook": {
			// A claim is sent as the whole book's card → holder map, which is the
			// right thing to send and unreadable as advice. `bookOfClaim` is the
			// same function the rules use to decide what is being declared, so the
			// name here can never disagree with what the move would actually claim.
			const book = bookOfClaim( move.input.claim, game.config.type );
			return book
				? `CLAIM ${ getBookDisplayString( book, game.config.type ) }`
				: "CLAIM A BOOK";
		}

		case "transferTurn":
			return `PASS THE TURN TO ${ nameOf( move.input.transferTo ) }`;
	}
};

export type FishHintProps = {
	readonly game: GameView<FishView, FishConfig>;
	readonly gameId: string;
	readonly disabled?: boolean;
};

export function FishHint( { game, gameId, disabled }: FishHintProps ) {
	const request = { params: { gameId: GameId.make( gameId ) } };
	const describe = ( hint: FishHint ) => describeHint( hint, game );
	return <HintButton { ...useHint( hintAtom, request, describe ) } disabled={ disabled }/>;
}
