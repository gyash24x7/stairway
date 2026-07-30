import { useState } from "react";

import type { CardSuit } from "@/shared/cards/schema.ts";
import { CARD_SUITS } from "@/shared/cards/utils.ts";
import { RCardSuit } from "@/shared/ui/components/card.tsx";
import { CreateGame } from "@/shared/ui/components/create-game.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { createCallbreakGameFn } from "@/games/callbreak/client/client.ts";

export function CallbreakCreateGame() {
	const [ trumpSuit, setTrumpSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<5 | 9 | 13>();

	const createCallbreakGame = async () => {
		if ( !dealCount || !trumpSuit ) {
			return "";
		}
		const { id } = await createCallbreakGameFn( {
			playerCount: 4,
			autoStart: false,
			dealCount,
			trumpSuit
		} );

		return id;
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
