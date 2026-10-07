import type { CoupConfig, CoupHint, CoupView } from "@/games/coup/schema";
import { hintAtom } from "@/games/coup/ui/client";
import type { GameView, PlayerId } from "@/swish/schema";
import { GameId } from "@/swish/schema";
import { HintButton, NO_HINT, useHint } from "@/swish/ui/hint";


/**
 * The moves that carry nothing, worded one for one.
 *
 * Coup's policy is a deliberate bluffer, and the wording here does not soften
 * that: told to claim a Duke it has not got, it says so, because a player acting
 * on the hint is the one who will have to answer the challenge.
 */
const PLAIN: Record<string, string> = {
	income: "TAKE INCOME — 1 COIN, AND NOBODY CAN ARGUE",
	foreignAid: "TAKE FOREIGN AID — 2 COINS, UNLESS A DUKE STOPS YOU",
	tax: "TAX — CLAIM THE DUKE AND TAKE 3",
	exchange: "EXCHANGE — CLAIM THE AMBASSADOR AND REDRAW",
	challenge: "CHALLENGE IT — THEY CANNOT HAVE THAT CARD",
	blockForeignAid: "BLOCK IT — CLAIM THE DUKE",
	blockAssassination: "BLOCK IT — CLAIM THE CONTESSA"
};

export const describeHint = (
	{ move }: CoupHint,
	game: GameView<CoupView, CoupConfig>
) => {
	if ( !move ) {
		// The one game where declining is a real answer a player might want: a
		// policy with nothing to say about a challenge window means let it pass.
		return NO_HINT;
	}

	const nameOf = ( playerId: PlayerId ) => game.players[ playerId ]?.name ?? "THEM";

	switch ( move.moveType ) {
		case "coup":
			return `COUP ${ nameOf( move.input.target ) }`;

		case "assassinate":
			return `ASSASSINATE ${ nameOf( move.input.target ) } — CLAIM THE ASSASSIN`;

		case "steal":
			return `STEAL FROM ${ nameOf( move.input.target ) } — CLAIM THE CAPTAIN`;

		case "blockSteal":
			return `BLOCK THE STEAL — CLAIM THE ${ move.input.claim }`;

		case "reveal":
			return `GIVE UP YOUR ${ move.input.card }`;

		case "exchangeReturn":
			return `PUT BACK ${ move.input.cards.join( " AND " ) }`;

		default:
			return PLAIN[ move.moveType ] ?? NO_HINT;
	}
};

export type CoupHintProps = {
	readonly game: GameView<CoupView, CoupConfig>;
	readonly gameId: string;
	readonly disabled?: boolean;
};

export function CoupHint( { game, gameId, disabled }: CoupHintProps ) {
	const request = { params: { gameId: GameId.make( gameId ) } };
	const describe = ( hint: CoupHint ) => describeHint( hint, game );
	return <HintButton { ...useHint( hintAtom, request, describe ) } disabled={ disabled }/>;
}
