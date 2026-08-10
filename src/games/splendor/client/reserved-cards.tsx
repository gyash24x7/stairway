"use client";

import { useState } from "react";

import type { PlayerId } from "@/shared/swish/schema.ts";
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
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PurchaseCard } from "@/games/splendor/client/purchase-card.tsx";
import { gemLightColors } from "@/games/splendor/client/utils.tsx";

/**
 * The interactive reserved-cards tile: opens a drawer of a seat's reserved cards,
 * and lets you buy one of your own on your turn.
 *
 * Lives outside `player-info.tsx` because it is the one part of a seat's row that
 * is *not* audience-agnostic — it reads the seated player's own hand and mutates.
 * The couch screen renders the plain count tile from `player-info.tsx` instead.
 */
export function ReservedCardsDrawer( props: { playerId: PlayerId } ) {
	const { data } = useSplendor();
	const playerData = data.view.playerData[ props.playerId ];
	const playerName = data.players[ props.playerId ].name.toUpperCase();
	const reserved = playerData?.reserved ?? [];

	const [ open, setOpen ] = useState( false );
	const [ selectedCardId, setSelectedCardId ] = useState<string>();

	const selectedCard = reserved.find( c => c.id === selectedCardId );

	const isOwnCards = props.playerId === data.view.playerId;
	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === data.view.playerId;

	const canSelect = isOwnCards && isMyTurn;

	const discounts = data.view.playerData[ data.view.playerId ].cards;
	const tokens = data.view.playerData[ data.view.playerId ].tokens;

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
					"border-2 border-inverted-surface",
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
						renderOption={ ( cardId ) => {
							const card = reserved.find( c => c.id === cardId )!;
							return <GameCard card={ card }/>;
						} }
					/>
				</div>
				<DrawerFooter>
					{ canSelect && selectedCard && (
						<PurchaseCard
							gameId={ data.id }
							card={ selectedCard }
							tokens={ tokens }
							discounts={ discounts }
						/>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
