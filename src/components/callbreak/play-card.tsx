"use client";

import { Button } from "@/components/base/button";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@/components/base/drawer";
import { Spinner } from "@/components/base/spinner";
import { DisplayCard } from "@/components/main/display-card";
import { getCardFromId, getCardId } from "@/libs/cards/card";
import { getSortedHand } from "@/libs/cards/hand";
import { getBestCardPlayed, getPlayableCards } from "@/libs/cards/utils";
import { playCard } from "@/server/callbreak/functions";
import { store } from "@/stores/callbreak";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";

export function PlayCard() {
	const [ isPending, startTransition ] = useTransition();
	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ open, setOpen ] = useState( false );

	const gameId = useStore( store, state => state.game.id );
	const dealId = useStore( store, state => state.currentDeal!.id );
	const roundId = useStore( store, state => state.currentRound!.id );
	const playerId = useStore( store, state => state.playerId );
	const playableCards = useStore( store, state => {
		const roundSuit = state.currentRound?.suit;
		const trumpSuit = state.game.trumpSuit;
		const cardsPlayed = Object.values( state.currentRound?.cards ?? {} ).map( getCardFromId );
		const bestCardPlayed = getBestCardPlayed( cardsPlayed ?? [], trumpSuit, roundSuit );
		return getPlayableCards( state.hand, trumpSuit, bestCardPlayed, roundSuit );
	} );

	const openDrawer = () => {
		setOpen( true );
	};

	const closeDrawer = () => {
		setSelectedCard( undefined );
		setOpen( false );
	};

	const handleCardSelect = ( cardId?: string ) => () => {
		setSelectedCard( cardId );
	};

	const handleClick = () => startTransition( async () => {
		await playCard( { gameId, dealId, roundId, cardId: selectedCard!, playerId } );
		closeDrawer();
	} );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button onClick={ openDrawer } className={ "w-full max-w-lg" }>PLAY CARD</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>SELECT CARD TO PLAY</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-3 md:px-4" }>
						<div className={ "flex gap-3 flex-wrap justify-center" }>
							{ getSortedHand( playableCards ).map( getCardId ).map( ( cardId ) => (
								<div
									key={ cardId }
									onClick={ handleCardSelect( selectedCard === cardId ? undefined : cardId ) }
									className={ "cursor-pointer rounded-md flex justify-center" }
								>
									<DisplayCard cardId={ cardId } focused={ selectedCard === cardId }/>
								</div>
							) ) }
						</div>
					</div>
					<DrawerFooter>
						<Button
							onClick={ handleClick }
							disabled={ isPending || !selectedCard }
							className={ "max-w-lg" }
						>
							{ isPending ? <Spinner/> : "PLAY CARD" }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
