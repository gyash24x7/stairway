"use client";

import { useFish } from "@/fish/components/context";
import { askCard } from "@/fish/core/actions";
import type { Book } from "@/fish/core/types";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	getOpponents
} from "@/fish/core/utils";
import { RCard } from "@/shared/components/card";
import { RPlayerInfo } from "@/shared/components/player-info";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/primitives/dialog";
import { Spinner } from "@/shared/primitives/spinner";
import { type CardId, getCardDisplayString } from "@/shared/utils/cards";
import { cn } from "@/shared/utils/cn";
import { useState, useTransition } from "react";
import { useStep } from "usehooks-ts";

export function AskCard() {
	const { shared, player } = useFish();
	const playerInfo = shared.players[ player.playerId ];

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	const askableBooks = Array.from( getBooksInHand( player.hand, shared.config.type ) )
		.filter( book => {
			const cards = getCardsOfBook( book, shared.config.type, player.hand );
			return cards.length !== 6;
		} );

	const opponentsWithCards = getOpponents( shared.state.teams, playerInfo.id )
		.map( memberId => ( { ...shared.players[ memberId ], ...shared.state.playerData[ memberId ] } ) )
		.filter( member => !!shared.state.cardCounts[ member.id ] );

	const confirmAskDialogTitle = selectedPlayer && selectedCard
		? `Ask ${ shared.players[ selectedPlayer ].name } for ${ getCardDisplayString( selectedCard ) }`
		: "";

	const openDialog = () => setOpen( true );

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

	const closeDialog = () => {
		setSelectedBook( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		reset();
		setOpen( false );
	};

	const [ isPending, startTransition ] = useTransition();

	const handleClick = () => startTransition( async () => {
		if ( selectedCard && selectedPlayer ) {
			await askCard( { gameId: shared.id, cardId: selectedCard, from: selectedPlayer } );
			closeDialog();
		}
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<Button onClick={ openDialog } className={ "flex-1 max-w-lg" }>ASK CARD</Button>
			<DialogContent className={ "min-w-xl" }>
				<DialogHeader>
					<DialogTitle>
						{ currentStep === 1 && "Select Book to Ask from".toUpperCase() }
						{ currentStep === 2 && "Select Card to Ask".toUpperCase() }
						{ currentStep === 3 && "Select Player to Ask from".toUpperCase() }
						{ currentStep === 4 && confirmAskDialogTitle.toUpperCase() }
					</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				{ currentStep === 1 && (
					<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
						{ askableBooks.map( ( item ) => (
							<div
								key={ item }
								onClick={ handleBookSelect( selectedBook === item ? undefined : item ) }
								className={ cn(
									"cursor-pointer rounded-md border-2 px-2 md:px-4 py-1 md:py-2",
									"flex justify-center bg-background border-gray-400",
									selectedBook === item && "border-accent bg-accent/20"
								) }
							>
								<div className={ "flex gap-2 md:gap-3 items-center" }>
									<h1 className={ cn( "text-md md:text-lg xl:text-xl font-semibold" ) }>
										{ getBookDisplayString( item, shared.config.type ) }
									</h1>
								</div>
							</div>
						) ) }
					</div>
				) }
				{ currentStep === 2 && (
					<div className={ "flex gap-3 flex-wrap justify-center" }>
						{ getMissingCards( player.hand, selectedBook!, shared.config.type ).map( cardId => (
							<div
								key={ cardId }
								onClick={ handleCardSelect( selectedCard === cardId ? undefined : cardId ) }
								className={ cn(
									"cursor-pointer rounded-md flex justify-center p-1",
									selectedCard === cardId && "border-2 border-accent bg-accent/20"
								) }
							>
								<RCard cardId={ cardId }/>
							</div>
						) ) }
					</div>
				) }
				{ currentStep === 3 && (
					<div className={ "grid gap-3 grid-cols-3" }>
						{ opponentsWithCards.map( ( p ) => (
							<div
								key={ p.id }
								onClick={ handlePlayerSelect( selectedPlayer === p.id ? undefined : p.id ) }
								className={ cn(
									"cursor-pointer border-2 rounded-md flex justify-center flex-1 bg-background",
									selectedPlayer === p.id && "border-2 border-accent bg-accent/20"
								) }
							>
								<RPlayerInfo player={ p }/>
							</div>
						) ) }
					</div>
				) }
				<DialogFooter>
					{ currentStep === 1 && (
						<Button className={ "w-full" } onClick={ goToNextStep } disabled={ !selectedBook }>
							SELECT BOOK
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
