"use client";

import { useState } from "react";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PurchaseCard } from "@/games/splendor/client/purchase-card.tsx";
import { gemLightColors } from "@/games/splendor/client/utils.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { PlayerId } from "@/swish/shared/schema.ts";

/**
 * The interactive reserved-cards tile: opens a drawer of a seat's reserved cards,
 * and lets you buy one of your own on your turn.
 *
 * Lives outside `player-info.tsx` because it is the one part of a seat's row that
 * mutates. The couch screen renders the plain count tile from `player-info.tsx`
 * instead, which is why that file stays audience-agnostic.
 */
export function ReservedCardsDrawer( props: { playerId: PlayerId } ) {
	const { data, playerId, isMyTurn } = useSplendor();

	const [ open, setOpen ] = useState( false );
	const [ selectedCardId, setSelectedCardId ] = useState<string>();

	const reserved = data.view.playerData[ props.playerId ]?.reserved ?? [];
	const playerName = ( data.players[ props.playerId ]?.name ?? "" ).toUpperCase();
	const selectedCard = reserved.find( c => c.id === selectedCardId );

	const me = playerId ? data.view.playerData[ playerId ] : undefined;
	const isOwnCards = props.playerId === playerId;
	const canSelect = isOwnCards && isMyTurn && !!me;

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
						{ !isOwnCards && <span>&nbsp;FOR { playerName }</span> }
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
					{ canSelect && !!selectedCard && !!me && (
						<PurchaseCard card={ selectedCard } tokens={ me.tokens } discounts={ me.cards }/>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
