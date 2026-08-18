"use client";

import { useState } from "react";

import { callbreakApi } from "@/games/callbreak/client/client.ts";
import { CALLBREAK_DEAL_COUNTS } from "@/games/callbreak/shared/schema.ts";
import { CARD_SUITS } from "@/shared/cards/utils.ts";
import { RCardSuit } from "@/shared/ui/components/card.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { CreateGame } from "@/swish/client/create-game.tsx";

import type { DealCount } from "@/games/callbreak/shared/schema.ts";
import type { CardSuit } from "@/shared/cards/schema.ts";

export function CallbreakCreateGame() {
	const [ trumpSuit, setTrumpSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<DealCount>();

	// Four seats, the move clock and the manual start are fixed server-side.
	const createCallbreakGame = () =>
		callbreakApi.createGame( { dealCount: dealCount!, trumpSuit: trumpSuit! } );

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
