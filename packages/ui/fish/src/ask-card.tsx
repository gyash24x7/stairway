"use client";

import { Button } from "@s2h-ui/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@s2h-ui/primitives/drawer";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCard } from "@s2h-ui/shared/display-card";
import { DisplayPlayer } from "@s2h-ui/shared/display-player";
import type { CardId } from "@s2h/cards/types";
import { getCardDisplayString, getCardFromId } from "@s2h/cards/utils";
import { useAskCardMutation } from "@s2h/client/fish";
import type { Book } from "@s2h/fish/types";
import { getBooksInHand, getCardsOfBook, getMissingCards } from "@s2h/fish/utils";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { useStep } from "usehooks-ts";
import { store } from "./store";

export function AskCard() {
	const gameId = useStore( store, state => state.id );
	const bookType = useStore( store, state => state.config.type );
	const player = useStore( store, state => state.players[ state.playerId ] );
	const players = useStore( store, state => state.players );
	const hand = useStore( store, state => state.hand );
	const cardCounts = useStore( store, state => state.cardCounts );

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	const askableBooks = Array.from( getBooksInHand( hand, bookType ) ).filter( book => {
		const cards = getCardsOfBook( book, bookType, hand );
		return cards.length !== 6;
	} );

	const opponentsWithCards = player.opponents
		.map( memberId => players[ memberId ] )
		.filter( member => !!cardCounts[ member.id ] );

	const confirmAskDrawerTitle = selectedPlayer && selectedCard
		? `Ask ${ players[ selectedPlayer ].name } for ${ getCardDisplayString( getCardFromId( selectedCard ) ) }`
		: "";

	const { mutateAsync, isPending } = useAskCardMutation( {
		onSettled: () => closeDrawer()
	} );

	const openDrawer = () => setOpen( true );

	const handleBookSelect = ( value?: Book ) => () => {
		if ( !value ) {
			setSelectedBook( undefined );
		} else {
			setSelectedBook( value );
			goToNextStep();
		}
	};

	const handleCardSelect = ( cardId?: CardId ) => () => {
		if ( !cardId ) {
			setSelectedCard( undefined );
		} else {
			setSelectedCard( cardId );
			goToNextStep();
		}
	};

	const handlePlayerSelect = ( player?: string ) => () => {
		if ( !player ) {
			setSelectedPlayer( undefined );
		} else {
			setSelectedPlayer( player );
			goToNextStep();
		}
	};

	const closeDrawer = () => {
		setSelectedBook( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		reset();
		setOpen( false );
	};

	const handleClick = () => mutateAsync( { gameId, from: selectedPlayer!, cardId: selectedCard! } );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>ASK CARD</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>
							{ currentStep === 1 && "Select Book to Ask from".toUpperCase() }
							{ currentStep === 2 && "Select Card to Ask".toUpperCase() }
							{ currentStep === 3 && "Select Player to Ask from".toUpperCase() }
							{ currentStep === 4 && confirmAskDrawerTitle.toUpperCase() }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-3 md:px-4" }>
						{ currentStep === 1 && (
							<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
								{ askableBooks.map( ( item ) => (
									<div
										key={ item }
										onClick={ handleBookSelect( selectedBook === item ? undefined : item ) }
										className={ cn(
											selectedBook === item ? "bg-white" : "bg-bg",
											"cursor-pointer rounded-md border-2 px-2 md:px-4 py-1 md:py-2",
											"flex justify-center"
										) }
									>
										<div className={ "flex gap-2 md:gap-3 items-center" }>
											<h1
												className={ cn(
													"text-gray-800",
													"text-md md:text-lg xl:text-xl font-semibold"
												) }
											>
												{ item }
											</h1>
										</div>
									</div>
								) ) }
							</div>
						) }
						{ currentStep === 2 && (
							<div className={ "flex gap-3 flex-wrap justify-center" }>
								{ getMissingCards( hand, selectedBook!, bookType ).map( ( cardId ) => (
									<div
										key={ cardId }
										onClick={ handleCardSelect( selectedCard === cardId ? undefined : cardId ) }
										className={ "cursor-pointer rounded-md flex justify-center" }
									>
										<DisplayCard cardId={ cardId } focused={ selectedCard === cardId }/>
									</div>
								) ) }
							</div>
						) }
						{ currentStep === 3 && (
							<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
								{ opponentsWithCards.map( ( p ) => (
									<div
										key={ p.id }
										onClick={ handlePlayerSelect( selectedPlayer === p.id ? undefined : p.id ) }
										className={ cn(
											selectedPlayer === p.id ? "bg-white" : "bg-bg",
											"cursor-pointer border-2 rounded-md flex justify-center flex-1"
										) }
									>
										<DisplayPlayer player={ p }/>
									</div>
								) ) }
							</div>
						) }
					</div>
					<DrawerFooter>
						{ currentStep === 1 && (
							<Button className={ "w-full" } onClick={ goToNextStep } disabled={ !selectedBook }>
								SELECT CARD SET
							</Button>
						) }
						{ currentStep === 2 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ goToNextStep } disabled={ !selectedCard } className={ "flex-1" }>
									SELECT CARD
								</Button>
							</div>
						) }
						{ currentStep === 3 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ goToNextStep } disabled={ !selectedPlayer } className={ "flex-1" }>
									SELECT PLAYER
								</Button>
							</div>
						) }
						{ currentStep === 4 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
									{ isPending ? <Spinner/> : "ASK CARD" }
								</Button>
							</div>
						) }
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
