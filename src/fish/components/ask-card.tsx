"use client";

import { askCard } from "@/fish/server/functions";
import { store } from "@/fish/store";
import type { CardId } from "@/libs/cards/types";
import { getCardDisplayString, getCardFromId } from "@/libs/cards/utils";
import type { FishBook } from "@/libs/fish/types";
import { getBooksInHand, getCardsOfBook, getMissingCards } from "@/libs/fish/utils";
import { DisplayBook, DisplayCard } from "@/shared/components/display-card";
import { DisplayPlayer } from "@/shared/components/display-player";
import { Button } from "@/shared/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";
import { useStep } from "usehooks-ts";

export function AskCard() {
	const [ isPending, startTransition ] = useTransition();

	const gameId = useStore( store, state => state.id );
	const bookType = useStore( store, state => state.config.type );
	const player = useStore( store, state => state.players[ state.playerId ] );
	const players = useStore( store, state => state.players );
	const hand = useStore( store, state => state.hand );
	const cardCounts = useStore( store, state => state.cardCounts );

	const [ selectedBook, setSelectedBook ] = useState<FishBook>();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	const openDrawer = () => setOpen( true );

	const askableBooks = Array.from( getBooksInHand( hand, bookType ) ).filter( book => {
		const cards = getCardsOfBook( book, bookType, hand );
		return cards.length !== 6;
	} );

	const opponentsWithCards = player.opponents
		.map( memberId => players[ memberId ] )
		.filter( member => !!cardCounts[ member.id ] );

	const handleBookSelect = ( value?: FishBook ) => () => {
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

	const confirmAskDrawerTitle = selectedPlayer && selectedCard
		? `Ask ${ players[ selectedPlayer ].name } for ${ getCardDisplayString( getCardFromId( selectedCard ) ) }`
		: "";

	const handleClick = () => startTransition( async () => {
		await askCard( { gameId, askedFrom: selectedPlayer!, cardId: selectedCard! } );
		closeDrawer();
	} );

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
										<DisplayBook book={ item }/>
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
