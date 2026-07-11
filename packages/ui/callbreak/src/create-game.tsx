"use client";

import { client } from "@s2h/client";
import { RCardSuit } from "@s2h/ui/components/card";
import { CreateGame } from "@s2h/ui/components/create-game";
import { RadioSelect } from "@s2h/ui/primitives/radio-select";
import { CARD_SUITS, type CardSuit } from "@s2h/utils/cards";
import { useState } from "react";

export function CallbreakCreateGame() {
	const [ trumpSuit, setTrumpSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<5 | 9 | 13>();

	const createCallbreakGame = async () => {
		if ( !!dealCount && !!trumpSuit ) {
			return client.callbreak.createGame( { dealCount, trumpSuit } );
		}
		return "";
	};

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
					renderOption={ suit => <RCardSuit suit={ suit } themed/> }
				/>

				<label className={ "text-sm text-muted-foreground" }>Deal Count</label>
				<RadioSelect
					options={ [ 5, 9, 13 ] as const }
					value={ dealCount }
					onChange={ setDealCount }
				/>
			</div>
		</CreateGame>
	);
}
