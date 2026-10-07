import { useAtomSet } from "@effect/atom-react";

import { useState } from "react";

import type { DealCount } from "@/games/callbreak/schema";
import { CALLBREAK_DEAL_COUNTS } from "@/games/callbreak/schema";
import { createGameAtom } from "@/games/callbreak/ui/client";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { RCardSuit } from "@/shared/shell/card";
import type { CardSuit } from "@/shared/utils/cards";
import { CARD_SUITS } from "@/shared/utils/cards";
import type { CreateGameOptions } from "@/swish/ui/create-game";
import { CreateGame } from "@/swish/ui/create-game";

export function CallbreakCreateGame() {
	const [ trumpSuit, setTrumpSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<DealCount>();

	const createGame = useAtomSet( createGameAtom, { mode: "promise" } );

	// Four seats, the move clock and the manual start are fixed server-side.
	const createCallbreakGame = ( { isPrivate }: CreateGameOptions ) => createGame( {
		payload: { dealCount: dealCount!, trumpSuit: trumpSuit!, isPrivate }
	} );

	return (
		<CreateGame
			game={ "callbreak" }
			disabled={ !trumpSuit || !dealCount }
			createGame={ createCallbreakGame }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Trump Suit</label>
				<RadioSelect
					options={ Object.values( CARD_SUITS ) }
					value={ trumpSuit }
					onChange={ setTrumpSuit }
					renderOption={ suit => <RCardSuit suit={ suit } large themed/> }
				/>

				<label className={ "text-sm text-muted-foreground" }>Deal Count</label>
				<RadioSelect
					options={ CALLBREAK_DEAL_COUNTS }
					value={ dealCount }
					onChange={ setDealCount }
				/>
			</div>
		</CreateGame>
	);
}
