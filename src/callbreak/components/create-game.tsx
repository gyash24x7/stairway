"use client";

import { createGame } from "@/callbreak/core/actions";
import { RCardSuit } from "@/shared/components/card";
import { CreateGame } from "@/shared/components/create-game";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { CARD_SUITS, type CardSuit } from "@/shared/utils/cards";
import { useState } from "react";

export function CallbreakCreateGame() {
	const [ trumpSuit, setTrumpSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<5 | 9 | 13>();

	const createCallbreakGame = async () => {
		if ( !!dealCount && !!trumpSuit ) {
			return createGame( { dealCount, trumpSuit } );
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
