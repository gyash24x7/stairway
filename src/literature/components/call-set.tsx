"use client";

import { getCardDisplayString, getCardFromId, getCardId } from "@/libs/cards/card";
import { cardSetMap } from "@/libs/cards/constants";
import { getCardsOfSet, getSetsInHand } from "@/libs/cards/hand";
import type { CardSet, PlayingCard } from "@/libs/cards/types";
import { callSet } from "@/literature/server/functions";
import { store } from "@/literature/store";
import { DisplayCard, DisplayCardSet } from "@/shared/components/display-card";
import { Button } from "@/shared/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { Fragment, useState, useTransition } from "react";
import { useStep } from "usehooks-ts";

export function CallSet() {
	const [ isPending, startTransition ] = useTransition();

	const gameId = useStore( store, state => state.game.id );
	const hand = useStore( store, state => state.hand );
	const playerId = useStore( store, state => state.playerId );
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

	const handleCardSetSelect = ( value?: string ) => () => {
		if ( !value ) {
			setSelectedCardSet( undefined );
		} else {
			const cardSet: CardSet = value as CardSet;
			setSelectedCardSet( cardSet );
			setCardOptions( cardSetMap[ cardSet ] );

			const myCardMap: Record<string, string> = {};
			getCardsOfSet( hand, cardSet ).map( getCardId ).forEach( cardId => {
				myCardMap[ cardId ] = playerId;
			} );
			setCardMap( myCardMap );
			goToNextStep();
		}
	};

	const handleCardSelectForPlayer = ( cardId: string, playerId?: string ) => () => {
		if ( !playerId ) {
			setCardMap( data => {
				delete data[ cardId ];
				return { ...data };
			} );
		} else {
			setCardMap( data => ( { ...data, [ cardId ]: playerId } ) );
		}
	};

	const handleClick = () => startTransition( async () => {
		await callSet( { gameId, data: cardMap } );
		closeDrawer();
	} );

	const [ currentStep, { goToNextStep, goToPrevStep } ] = useStep( 3 );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>CALL SET</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg overscroll-y-auto" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>
							{ currentStep === 1 && "Select Card Set to Call".toUpperCase() }
							{ currentStep === 2 && "Select Card Locations".toUpperCase() }
							{ currentStep === 3 && `Confirm Call for ${ selectedCardSet }`.toUpperCase() }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						{ currentStep === 1 && (
							<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
								{ Array.from( getSetsInHand( hand ) ).map( ( item ) => (
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
							<div className={ "flex flex-col gap-3" }>
								{ team!.memberIds.map( playerId => players[ playerId ] ).map( player => (
									<Fragment key={ player.id }>
										<h1>Cards With { player.name }</h1>
										<div className={ "grid gap-3 grid-cols-6" }>
											{ cardOptions.map( getCardId ).map( ( cardId ) => (
												<div
													key={ cardId }
													onClick={ handleCardSelectForPlayer(
														cardId,
														cardMap[ cardId ] === player.id ? undefined : player.id
													) }
													className={ "cursor-pointer rounded-md flex justify-center" }
												>
													<DisplayCard
														cardId={ cardId }
														focused={ cardMap[ cardId ] === player.id }
													/>
												</div>
											) ) }
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
