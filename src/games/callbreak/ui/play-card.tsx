import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { playCardAtom } from "@/games/callbreak/ui/client";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import type { CardId } from "@/shared/utils/cards";
import { GameId } from "@/swish/schema";

export type PlayCardProps = {
	readonly gameId: string;
	readonly dealId?: string;
	readonly selectedCard?: CardId;
	readonly onPlayed: () => void;
};

export function PlayCard( { gameId, dealId, selectedCard, onPlayed }: PlayCardProps ) {
	const play = useAtomSet( playCardAtom, { mode: "promiseExit" } );
	const playing = useAtomValue( playCardAtom ).waiting;

	const handleClick = async () => {
		if ( !selectedCard || !dealId ) {
			return;
		}

		await play( {
			params: { gameId: GameId.make( gameId ) },
			payload: { dealId, cardId: selectedCard }
		} );

		onPlayed();
	};

	return (
		<Button
			onClick={ () => void handleClick() }
			disabled={ playing || !selectedCard || !dealId }
			className={ "w-full max-w-lg" }
		>
			{ playing ? <Spinner/> : "PLAY CARD" }
		</Button>
	);
}
