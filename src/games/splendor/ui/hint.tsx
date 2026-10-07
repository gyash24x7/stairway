import type { Card, SplendorConfig, SplendorHint, SplendorView } from "@/games/splendor/schema";
import { hintAtom } from "@/games/splendor/ui/client";
import { findOpenCard, findReservedCard } from "@/games/splendor/utils";
import type { GameView } from "@/swish/schema";
import { GameId } from "@/swish/schema";
import { HintButton, NO_HINT, useHint } from "@/swish/ui/hint";


/** A card by what it is worth and what it gives, since its id names nothing. */
const nameOf = ( card: Card | undefined, cardId: string ) => {
	if ( !card ) {
		return `CARD ${ cardId }`;
	}

	const points = card.points > 0 ? ` FOR ${ card.points }` : "";
	return `LEVEL ${ card.level } ${ card.bonus.toUpperCase() }${ points }`;
};

/** The gems a token pick actually takes, "2 SAPPHIRE, 1 RUBY". */
const gemList = ( tokens: Partial<Record<string, number>> ) =>
	Object.entries( tokens )
		.filter( ( [ , count ] ) => ( count ?? 0 ) > 0 )
		.map( ( [ gem, count ] ) => `${ count } ${ gem.toUpperCase() }` )
		.join( ", " );

export const describeHint = (
	{ move }: SplendorHint,
	game: GameView<SplendorView, SplendorConfig>
) => {
	if ( !move ) {
		return NO_HINT;
	}

	const me = game.view.playerId ? game.view.playerData[ game.view.playerId ] : undefined;

	// A card is on the board or in your own reserve, and the policy may name
	// either — `purchaseCard` takes one id for both. Looking in both places is
	// what `paymentFor` does on the server too.
	const cardNamed = ( cardId: string ) => nameOf(
		findOpenCard( cardId, game.view.cards )
		?? ( me ? findReservedCard( cardId, me ) : undefined ),
		cardId
	);

	switch ( move.moveType ) {
		case "pickTokens": {
			const taken = gemList( move.input.tokens );
			const returned = move.input.returned ? gemList( move.input.returned ) : "";
			return returned
				? `TAKE ${ taken }, PUT BACK ${ returned }`
				: `TAKE ${ taken }`;
		}

		case "reserveCard":
			return `RESERVE THE ${ cardNamed( move.input.cardId ) }`;

		case "purchaseCard":
			return `BUY THE ${ cardNamed( move.input.cardId ) }`;

		case "passTurn":
			return "PASS — THERE IS NOTHING YOU CAN AFFORD";

		case "claimNoble": {
			const noble = game.view.nobles.find( n => n.id === move.input.nobleId );
			return noble
				? `TAKE THE NOBLE WORTH ${ noble.points }`
				: "TAKE A NOBLE";
		}
	}
};

export type SplendorHintProps = {
	readonly game: GameView<SplendorView, SplendorConfig>;
	readonly gameId: string;
	readonly disabled?: boolean;
};

export function SplendorHint( { game, gameId, disabled }: SplendorHintProps ) {
	const request = { params: { gameId: GameId.make( gameId ) } };
	const describe = ( hint: SplendorHint ) => describeHint( hint, game );
	return <HintButton { ...useHint( hintAtom, request, describe ) } disabled={ disabled }/>;
}
