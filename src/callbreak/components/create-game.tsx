"use client";

import { createGame } from "@/callbreak/core/actions";
import { RCardSuit } from "@/shared/components/card";
import { CreateGame } from "@/shared/components/create-game";
import { CARD_SUITS, type CardSuit } from "@/shared/utils/cards";
import { cn } from "@/shared/utils/cn";
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
				<div className={ "flex gap-3 flex-wrap" }>
					{ Object.values( CARD_SUITS ).map( ( item ) => (
						<div
							key={ item }
							onClick={ () => setTrumpSuit( trumpSuit === item ? undefined : item ) }
							className={ cn(
								trumpSuit === item ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
								"hover:bg-background border-inverted-surface"
							) }
						>
							<RCardSuit suit={ item } themed/>
						</div>
					) ) }
				</div>

				<label className={ "text-sm text-muted-foreground" }>Deal Count</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ [ 5 as const, 9 as const, 13 as const ].map( ( item ) => (
						<div
							key={ item }
							onClick={ () => setDealCount( dealCount === item ? undefined : item ) }
							className={ cn(
								dealCount === item ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
								"hover:bg-background border-inverted-surface"
							) }
						>
							{ item }
						</div>
					) ) }
				</div>
			</div>
		</CreateGame>
	);
}
