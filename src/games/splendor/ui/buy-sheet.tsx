import { useState } from "react";

import type { Card, CardLevel, CardsByLevel, PlayerData } from "@/games/splendor/schema";
import { SPLENDOR_MAX_RESERVED } from "@/games/splendor/schema";
import { GameCard } from "@/games/splendor/ui/game-card";
import { PurchaseCard } from "@/games/splendor/ui/purchase-card";
import { ReserveCard } from "@/games/splendor/ui/reserve-card";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { RadioSelect } from "@/shared/primitives/radio-select";


const LEVELS: ReadonlyArray<CardLevel> = [ 3, 2, 1 ];

export type BuySheetProps = {
	gameId: string;
	me: PlayerData;
	cards: CardsByLevel;
	goldAvailable: boolean;
};

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
export function BuySheet( { gameId, me, cards, goldAvailable }: BuySheetProps ) {
	const [ open, setOpen ] = useState( false );
	const [ selectedCardId, setSelectedCardId ] = useState<string>();

	const faceUp = LEVELS.flatMap( level => cards[ level ] as ReadonlyArray<Card> );
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
				<div className={ "px-4 flex flex-col gap-3 overflow-y-scroll max-h-100" }>
					{ LEVELS.map( level => (
						<RadioSelect
							key={ level }
							options={ cards[ level ].map( c => c.id ) }
							value={ selectedCardId }
							onChange={ setSelectedCardId }
							className={ "justify-center" }
							renderOption={ cardId => {
								const card = faceUp.find( c => c.id === cardId );
								return card ? <GameCard card={ card } disabled/> : null;
							} }
						/>
					) ) }
				</div>
				<DrawerFooter>
					{ !!selectedCard && (
						<div className={ "flex gap-2 justify-center flex-wrap" }>
							<PurchaseCard
								card={ selectedCard }
								tokens={ me.tokens }
								discounts={ me.cards }
								gameId={ gameId }
							/>
							<ReserveCard
								card={ selectedCard }
								tokens={ me.tokens }
								availableSlots={ SPLENDOR_MAX_RESERVED - me.reserved.length }
								isGoldAvailable={ goldAvailable }
								gameId={ gameId }
							/>
						</div>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
