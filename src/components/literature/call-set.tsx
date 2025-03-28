"use client";

import { Button } from "@/components/base/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/base/drawer";
import { Spinner } from "@/components/base/spinner";
import { SelectCardSet } from "@/components/literature/select-card-set";
import { SelectCard } from "@/components/main/select-card";
import { getCardDisplayString, getCardFromId } from "@/libs/cards/card";
import { cardSetMap } from "@/libs/cards/constants";
import { getSetsInHand } from "@/libs/cards/hand";
import type { CardSet, PlayingCard } from "@/libs/cards/types";
import { callSet } from "@/server/literature/functions";
import { store } from "@/stores/literature";
import { useStore } from "@tanstack/react-store";
import { Fragment, useState, useTransition } from "react";
import { useStep } from "usehooks-ts";

export function CallSet() {
	const [ isPending, startTransition ] = useTransition();

	const gameId = useStore( store, state => state.game.id );
	const hand = useStore( store, state => state.hand );
	const players = useStore( store, state => state.players );
	const team = useStore( store, state => {
		const player = state.players[ state.playerId ];
		if ( !player.teamId ) {
			return null;
		}
		return state.teams[ player.teamId ];
	} );

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<PlayingCard[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string>>( {} );

	const [ showDrawer, setShowDrawer ] = useState( false );

	const openDrawer = () => {
		setShowDrawer( true );
	};

	const closeDrawer = () => {
		setSelectedCardSet( undefined );
		setCardOptions( [] );
		setCardMap( {} );
		setShowDrawer( false );
	};

	const handleCardSetSelect = ( value?: string ) => {
		if ( !value ) {
			setSelectedCardSet( undefined );
		} else {
			const cardSet: CardSet = value as CardSet;
			setSelectedCardSet( cardSet );
			setCardOptions( cardSetMap[ cardSet ] );
		}
	};

	const handleCardSelectForPlayer = ( playerId: string ) => ( cardId: string ) => {
		setCardMap( data => ( { ...data, [ cardId ]: playerId } ) );
	};

	const handleCardDeSelectForPlayer = ( cardId: string ) => {
		setCardMap( data => {
			delete data[ cardId ];
			return { ...data };
		} );
	};

	const getCardsForPlayers = ( playerId: string ) => Object.keys( cardMap )
		.filter( cardId => cardMap[ cardId ] === playerId );

	const handleClick = () => startTransition( async () => {
		await callSet( { gameId, data: cardMap } );
		closeDrawer();
	} );

	const [ currentStep, { goToNextStep, goToPrevStep } ] = useStep( 3 );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>CALL SET</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>
							{ currentStep === 1 && "Select Card Set to Call" }
							{ currentStep === 2 && "Select Card Locations" }
							{ currentStep === 3 && `Confirm Call for ${ selectedCardSet }` }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						{ currentStep === 1 && (
							<SelectCardSet
								cardSet={ selectedCardSet }
								handleSelection={ handleCardSetSelect }
								cardSetOptions={ Array.from( getSetsInHand( hand ) ) }
							/>
						) }
						{ currentStep === 2 && (
							<div className={ "flex flex-col gap-3" }>
								{ team!.memberIds.map( playerId => players[ playerId ] ).map( player => (
									<Fragment key={ player.id }>
										<h1>Cards With { player.name }</h1>
										<div className={ "overflow-x-scroll" }>
											<SelectCard
												cards={ cardOptions }
												selectedCards={ getCardsForPlayers( player.id ) }
												onSelect={ handleCardSelectForPlayer( player.id ) }
												onDeselect={ handleCardDeSelectForPlayer }
											/>
										</div>
									</Fragment>
								) ) }
							</div>
						) }
						{ currentStep === 3 && (
							<div className={ "flex flex-col gap-3" }>
								{ Object.keys( cardMap ).map( cardId => (
									<h3 key={ cardId } className={ "text-center" }>
										{ getCardDisplayString( getCardFromId( cardId ) ) } is
										with { players[ cardMap[ cardId ] ].name }
									</h3>
								) ) }
							</div>
						) }
					</div>
					<DrawerFooter>
						{ currentStep === 1 && (
							<Button onClick={ goToNextStep } disabled={ !selectedCardSet }>
								SELECT CARD SET
							</Button>
						) }
						{ currentStep === 2 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ goToNextStep } className={ "flex-1" }>NEXT</Button>
							</div>
						) }
						{ currentStep === 3 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
									{ isPending ? <Spinner/> : "CALL SET" }
								</Button>
							</div>
						) }
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
