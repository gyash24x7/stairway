"use client";

import { orpc } from "@/app/client/orpc";
import { store } from "@/app/components/callbreak/store";
import { DisplayCard } from "@/app/components/shared/display-card";
import { Button } from "@/app/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/app/primitives/drawer";
import { Spinner } from "@/app/primitives/spinner";
import type { CardId } from "@/utils/cards";
import { getCardFromId, getCardId, getSortedHand } from "@/utils/cards";
import { getBestCardPlayed, getPlayableCards } from "@/workers/callbreak/utils";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";

export function PlayCard() {
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ open, setOpen ] = useState( false );

	const gameId = useStore( store, state => state.id );
	const dealId = useStore( store, state => state.currentDeal!.id );
	const roundId = useStore( store, state => state.currentRound!.id );
	const playableCards = useStore( store, state => {
		const roundSuit = state.currentRound?.suit;
		const trumpSuit = state.trump;
		const cardsPlayed = Object.values( state.currentRound?.cards ?? {} ).map( getCardFromId );
		const bestCardPlayed = getBestCardPlayed( cardsPlayed ?? [], trumpSuit, roundSuit );
		return getPlayableCards( state.hand, trumpSuit, bestCardPlayed, roundSuit );
	} );

	const { mutateAsync, isPending } = useMutation( orpc.callbreak.playCard.mutationOptions( {
		onSuccess: () => closeDrawer(),
		onError: ( error ) => alert( error.message )
	} ) );

	const openDrawer = () => {
		setOpen( true );
	};

	const closeDrawer = () => {
		setSelectedCard( undefined );
		setOpen( false );
	};

	const handleCardSelect = ( cardId?: CardId ) => () => {
		setSelectedCard( cardId );
	};

	const handleClick = () => mutateAsync( { gameId, dealId, roundId, cardId: selectedCard! } );

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
