import { cn } from "cn";
import { useState } from "react";

import type { Card, Tokens } from "@/games/splendor/schema";
import { GameCard } from "@/games/splendor/ui/game-card";
import { PurchaseCard } from "@/games/splendor/ui/purchase-card";
import { gemLightColors } from "@/games/splendor/ui/utils";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { RadioSelect } from "@/shared/primitives/radio-select";


export type ReservedCardsDrawerProps = {
	gameId: string;
	playerName: string;
	reserved: ReadonlyArray<Card>;
	/** Whether this drawer is showing the viewing seat's own reserved cards. */
	isOwnCards: boolean;
	isMyTurn: boolean;
	myTokens?: Tokens;
	myDiscounts?: readonly Card[];
};

/**
 * The interactive reserved-cards tile: opens a drawer of a seat's reserved cards,
 * and lets you buy one of your own on your turn.
 *
 * Lives outside `player-info.tsx` because it is the one part of a seat's row that
 * mutates. The couch screen renders the plain count tile from `player-info.tsx`
 * instead, which is why that file stays audience-agnostic.
 */
export function ReservedCardsDrawer( props: ReservedCardsDrawerProps ) {
	const { gameId, playerName, reserved, isOwnCards, isMyTurn, myTokens, myDiscounts } = props;

	const [ open, setOpen ] = useState( false );
	const [ selectedCardId, setSelectedCardId ] = useState<string>();

	const selectedCard = reserved.find( c => c.id === selectedCardId );
	const canSelect = isOwnCards && isMyTurn && !!myTokens;

	const handleOpenChange = ( isOpen: boolean ) => {
		setOpen( isOpen );
		if ( !isOpen ) {
			setSelectedCardId( undefined );
		}
	};

	return (
		<Drawer open={ open } onOpenChange={ handleOpenChange }>
			<div
				className={ cn(
					"w-8 h-12 p-1 cursor-pointer",
					"flex rounded-md items-center justify-center",
					"border-2 border-outline",
					"text-2xl text-neutral-dark",
					gemLightColors[ "gold" ]
				) }
				onClick={ () => reserved.length > 0 && setOpen( true ) }
			>
				<h2>{ reserved.length }</h2>
			</div>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>
						{ isOwnCards && <span>MY&nbsp;</span> }
						<span>RESERVED CARDS</span>
						{ !isOwnCards && <span>&nbsp;FOR { playerName.toUpperCase() }</span> }
					</DrawerTitle>
					<DrawerDescription>
						{ canSelect && <span>Select Card to Purchase</span> }
					</DrawerDescription>
				</DrawerHeader>
				<div className={ "px-4" }>
					<RadioSelect
						options={ reserved.map( c => c.id ) }
						value={ selectedCardId }
						onChange={ setSelectedCardId }
						isDisabled={ () => !canSelect }
						className={ "justify-center" }
						renderOption={ cardId => {
							const card = reserved.find( c => c.id === cardId );
							return card ? <GameCard card={ card } disabled/> : null;
						} }
					/>
				</div>
				<DrawerFooter>
					{ canSelect && !!selectedCard && !!myTokens && (
						<PurchaseCard
							card={ selectedCard }
							tokens={ myTokens }
							discounts={ myDiscounts ?? [] }
							gameId={ gameId }
						/>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
