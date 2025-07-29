"use client";

import { claimBook } from "@/fish/server/functions";
import { store } from "@/fish/store";
import type { CardId, PlayingCard } from "@/libs/cards/types";
import { getCardDisplayString, getCardId } from "@/libs/cards/utils";
import type { FishBook, PlayerId } from "@/libs/fish/types";
import { getBooksInHand, getCardsOfBook } from "@/libs/fish/utils";
import { DisplayBook, DisplayCard } from "@/shared/components/display-card";
import { Button } from "@/shared/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { Fragment, useState, useTransition } from "react";
import { useStep } from "usehooks-ts";

export function ClaimBook() {
	const [ isPending, startTransition ] = useTransition();

	const gameId = useStore( store, state => state.id );
	const hand = useStore( store, state => state.hand );
	const player = useStore( store, state => state.players[ state.playerId ] );
	const players = useStore( store, state => state.players );
	const bookType = useStore( store, state => state.config.type );

	const [ selectedBook, setSelectedBook ] = useState<FishBook>();
	const [ cardOptions, setCardOptions ] = useState<PlayingCard[]>( [] );
	const [ claim, setClaim ] = useState( new Map<CardId, PlayerId>() );

	const [ showDrawer, setShowDrawer ] = useState( false );

	const openDrawer = () => {
		setShowDrawer( true );
	};

	const closeDrawer = () => {
		setSelectedBook( undefined );
		setCardOptions( [] );
		setClaim( new Map() );
		setShowDrawer( false );
	};

	const handleBookSelect = ( value?: string ) => () => {
		if ( !value ) {
			setSelectedBook( undefined );
		} else {
			const book = value as FishBook;
			setSelectedBook( book );
			setCardOptions( getCardsOfBook( book, bookType ) );
			setClaim( data => {
				getCardsOfBook( book, bookType, hand ).map( getCardId ).forEach( cardId => {
					data.set( cardId, player.id );
				} );
				return data;
			} );
			goToNextStep();
		}
	};

	const handleCardSelectForPlayer = ( cardId: CardId, playerId?: string ) => () => {
		if ( !playerId ) {
			setClaim( data => {
				data.delete( cardId );
				return data;
			} );
		} else {
			setClaim( data => {
				data.set( cardId, playerId );
				return data;
			} );
		}
	};

	const handleClick = () => startTransition( async () => {
		await claimBook( {
			gameId,
			claim: claim.entries().reduce(
				( acc, [ cardId, playerId ] ) => {
					acc[ cardId ] = playerId;
					return acc;
				},
				{} as Record<CardId, PlayerId>
			)
		} );
		closeDrawer();
	} );

	const [ currentStep, { goToNextStep, goToPrevStep } ] = useStep( 3 );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>CLAIM BOOK</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg overscroll-y-auto" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>
							{ currentStep === 1 && "Select Book to Claim".toUpperCase() }
							{ currentStep === 2 && "Select Card Locations".toUpperCase() }
							{ currentStep === 3 && `Confirm Claim for ${ selectedBook }`.toUpperCase() }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						{ currentStep === 1 && (
							<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
								{ Array.from( getBooksInHand( hand, bookType ) ).map( ( item ) => (
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
							<div className={ "flex flex-col gap-3" }>
								{ player.teamMates.map( playerId => players[ playerId ] ).map( player => (
									<Fragment key={ player.id }>
										<h1>Cards With { player.name }</h1>
										<div className={ "grid gap-3 grid-cols-6" }>
											{ cardOptions.map( getCardId ).map( ( cardId ) => (
												<div
													key={ cardId }
													onClick={ handleCardSelectForPlayer(
														cardId,
														claim.get( cardId ) === player.id ? undefined : player.id
													) }
													className={ "cursor-pointer rounded-md flex justify-center" }
												>
													<DisplayCard
														cardId={ cardId }
														focused={ claim.get( cardId ) === player.id }
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
								{ claim.entries().map( ( [ cardId, playerId ] ) => (
									<h3 key={ cardId } className={ "text-center" }>
										{ getCardDisplayString( cardId ) } is with { players[ playerId ].name }
									</h3>
								) ) }
							</div>
						) }
					</div>
					<DrawerFooter>
						{ currentStep === 1 && (
							<Button onClick={ goToNextStep } disabled={ !selectedBook }>
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
