"use client";

import { Button } from "@/components/base/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/base/drawer";
import { Spinner } from "@/components/base/spinner";
import { SelectCardSet } from "@/components/literature/select-card-set";
import { SelectPlayer } from "@/components/literature/select-player";
import { SelectCard } from "@/components/main/select-card";
import { getCardDisplayString, getCardFromId } from "@/libs/cards/card";
import { getAskableCardsOfSet, getCardsOfSet, getSetsInHand } from "@/libs/cards/hand";
import type { CardSet } from "@/libs/cards/types";
import { askCard } from "@/server/literature/functions";
import { store } from "@/stores/literature";
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

	const openDrawer = () => setOpen( true );

	const askableCardSets = Array.from( getSetsInHand( hand ) ).filter( cardSet => {
		const cards = getCardsOfSet( hand, cardSet );
		return cards.length !== 6;
	} );

	const oppositeTeamMembersWithCards = oppositeTeam?.memberIds
		.map( memberId => players[ memberId ] )
		.filter( member => !!cardCounts[ member.id ] ) ?? [];

	const handleCardSetSelection = ( cardSet?: string ) => setSelectedCardSet( cardSet as CardSet | undefined );

	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

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
							{ currentStep === 1 && "Select Card Set to Ask" }
							{ currentStep === 2 && "Select Card to Ask" }
							{ currentStep === 3 && "Select Player to Ask" }
							{ currentStep === 4 && confirmAskDrawerTitle }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						{ currentStep === 1 && (
							<SelectCardSet
								cardSet={ selectedCardSet }
								cardSetOptions={ askableCardSets }
								handleSelection={ handleCardSetSelection }
							/>
						) }
						{ currentStep === 2 && (
							<SelectCard
								cards={ getAskableCardsOfSet( hand, selectedCardSet! ) }
								selectedCards={ !selectedCard ? [] : [ selectedCard ] }
								onSelect={ ( cardId ) => setSelectedCard( cardId ) }
								onDeselect={ () => setSelectedCard( undefined ) }
							/>
						) }
						{ currentStep === 3 && (
							<SelectPlayer
								player={ selectedPlayer }
								options={ oppositeTeamMembersWithCards }
								setPlayer={ setSelectedPlayer }
							/>
						) }
					</div>
					<DrawerFooter>
						{ currentStep === 1 && (
							<Button className={ "flex-1" } onClick={ goToNextStep } disabled={ !selectedCardSet }>
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
