"use client";

import { Button } from "@/components/base/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/base/drawer";
import { Spinner } from "@/components/base/spinner";
import { DisplayCard, DisplayCardSet } from "@/components/main/display-card";
import { DisplayPlayer } from "@/components/main/display-player";
import { getCardDisplayString, getCardFromId, getCardId } from "@/libs/cards/card";
import { getAskableCardsOfSet, getCardsOfSet, getSetsInHand } from "@/libs/cards/hand";
import type { CardSet } from "@/libs/cards/types";
import { askCard } from "@/server/literature/functions";
import { store } from "@/stores/literature";
import { cn } from "@/utils/cn";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";
import { useStep } from "usehooks-ts";

export function AskCard() {
	const [ isPending, startTransition ] = useTransition();
	const gameId = useStore( store, state => state.game.id );
	const players = useStore( store, state => state.players );
	const hand = useStore( store, state => state.hand );
	const cardCounts = useStore( store, state => state.cardCounts );
	const oppositeTeam = useStore( store, state => {
		const player = state.players[ state.playerId ];
		if ( !player.teamId ) {
			return null;
		}
		return Object.values( state.teams ).find( team => team.id !== player.teamId );
	} );

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	const openDrawer = () => setOpen( true );

	const askableCardSets = Array.from( getSetsInHand( hand ) ).filter( cardSet => {
		const cards = getCardsOfSet( hand, cardSet );
		return cards.length !== 6;
	} );

	const oppositeTeamMembersWithCards = oppositeTeam?.memberIds
		.map( memberId => players[ memberId ] )
		.filter( member => !!cardCounts[ member.id ] ) ?? [];

	const handleCardSetSelect = ( value?: string ) => () => {
		if ( !value ) {
			setSelectedCardSet( undefined );
		} else {
			setSelectedCardSet( value as CardSet | undefined );
			goToNextStep();
		}
	};

	const handleCardSelect = ( cardId?: string ) => () => {
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
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		reset();
		setOpen( false );
	};

	const confirmAskDrawerTitle = selectedPlayer && selectedCard
		? `Ask ${ players[ selectedPlayer ].name } for ${ getCardDisplayString( getCardFromId( selectedCard ) ) }`
		: "";

	const handleClick = () => startTransition( async () => {
		await askCard( { gameId, from: selectedPlayer!, card: selectedCard! } );
		closeDrawer();
	} );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>ASK CARD</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>
							{ currentStep === 1 && "Select Card Set to Ask".toUpperCase() }
							{ currentStep === 2 && "Select Card to Ask".toUpperCase() }
							{ currentStep === 3 && "Select Player to Ask".toUpperCase() }
							{ currentStep === 4 && confirmAskDrawerTitle.toUpperCase() }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-3 md:px-4" }>
						{ currentStep === 1 && (
							<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
								{ askableCardSets.map( ( item ) => (
									<div
										key={ item }
										onClick={ handleCardSetSelect( selectedCardSet === item ? undefined : item ) }
										className={ cn(
											selectedCardSet === item ? "bg-white" : "bg-bg",
											"cursor-pointer rounded-md border-2 px-2 md:px-4 py-1 md:py-2",
											"flex justify-center"
										) }
									>
										<DisplayCardSet cardSet={ item }/>
									</div>
								) ) }
							</div>
						) }
						{ currentStep === 2 && (
							<div className={ "flex gap-3 flex-wrap justify-center" }>
								{ getAskableCardsOfSet( hand, selectedCardSet! ).map( getCardId ).map( ( cardId ) => (
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
								{ oppositeTeamMembersWithCards.map( ( p ) => (
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
							<Button className={ "w-full" } onClick={ goToNextStep } disabled={ !selectedCardSet }>
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
