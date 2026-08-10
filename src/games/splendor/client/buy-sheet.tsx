"use client";

import { useState } from "react";

import type { Card, CardLevel } from "@/games/splendor/shared/schema.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PurchaseCard } from "@/games/splendor/client/purchase-card.tsx";
import { ReserveCard } from "@/games/splendor/client/reserve-card.tsx";

const LEVELS: ReadonlyArray<CardLevel> = [ 3, 2, 1 ];

/**
 * The controller's board action: the twelve face-up cards, and the buy/reserve
 * controls for whichever you pick.
 *
 * Scoped to the board on purpose — your own reserved cards are bought by tapping
 * them in the reserved section (`ReservedCardAction`), where the rest of your
 * private state lives. This replaces `CardActions` on the phone rather than
 * reusing it: `CardActions` opens its own drawer per card, which would nest
 * inside this one.
 */
export function BuySheet() {
	const { data } = useSplendor();
	const [ open, setOpen ] = useState( false );
	const [ selectedCardId, setSelectedCardId ] = useState<string>();

	const {
		cards: discounts,
		reserved,
		tokens: playerTokens
	} = data.view.playerData[ data.view.playerId ];

	const faceUp = LEVELS.flatMap( level => data.view.cards[ level ] as ReadonlyArray<Card> );
	const selectedCard = faceUp.find( c => c.id === selectedCardId );

	const handleOpenChange = ( isOpen: boolean ) => {
		setOpen( isOpen );
		if ( !isOpen ) {
			setSelectedCardId( undefined );
		}
	};

	return (
		<Drawer open={ open } onOpenChange={ handleOpenChange }>
			<Button className={ "flex-1" } onClick={ () => setOpen( true ) }>BUY OR RESERVE</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>BUY OR RESERVE</DrawerTitle>
					<DrawerDescription>Select a card from the board</DrawerDescription>
				</DrawerHeader>
				<div className={ "px-4 flex flex-col gap-3 overflow-y-auto" }>
					{ LEVELS.map( level => (
						<RadioSelect
							key={ level }
							options={ data.view.cards[ level ].map( c => c.id ) }
							value={ selectedCardId }
							onChange={ setSelectedCardId }
							className={ "justify-center" }
							renderOption={ ( cardId ) => {
								const card = faceUp.find( c => c.id === cardId )!;
								return <GameCard card={ card }/>;
							} }
						/>
					) ) }
				</div>
				<DrawerFooter>
					{ !!selectedCard && (
						<div className={ "flex gap-2 justify-center flex-wrap" }>
							<PurchaseCard
								gameId={ data.id }
								card={ selectedCard }
								tokens={ playerTokens }
								discounts={ discounts }
							/>
							<ReserveCard
								gameId={ data.id }
								card={ selectedCard }
								tokens={ playerTokens }
								availableSlots={ 3 - reserved.length }
								isGoldAvailable={ data.view.tokens.gold > 0 }
							/>
						</div>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
