"use client";

import { useState } from "react";
import { useStep } from "usehooks-ts";

import { useFish } from "@/games/fish/client/context.tsx";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards
} from "@/games/fish/shared/utils.ts";
import { getCardDisplayString } from "@/shared/cards/utils.ts";
import { RCard } from "@/shared/ui/components/card.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { RPlayerInfo } from "@/swish/client/player-info.tsx";
import { opponentsOf } from "@/swish/shared/teams.ts";

import type { Book } from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

export function AskCard() {
	const { data, askCard, isPending } = useFish();
	const hand = data.view.hand;

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<PlayerId>();
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	// A book you already hold in full is not askable — there is nothing missing.
	const askableBooks = getBooksInHand( hand, data.config.type )
		.filter( book => getCardsOfBook( book, hand ).length !== data.config.bookSize );

	const opponentsWithCards = opponentsOf( data.context, data.view.playerId )
		.filter( playerId => ( data.view.cardCounts[ playerId ] ?? 0 ) > 0 );

	const confirmTitle = selectedPlayer && selectedCard
		? `Ask ${ data.players[ selectedPlayer ]?.name } for ${ getCardDisplayString( selectedCard ) }`
		: "";

	const closeDrawer = () => {
		setSelectedBook( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		reset();
		setOpen( false );
	};

	const handleBookSelect = ( value: Book | undefined ) => {
		setSelectedBook( value );
		setSelectedCard( undefined );
		if ( value !== undefined ) {
			goToNextStep();
		}
	};

	const handleCardSelect = ( cardId: CardId | undefined ) => {
		setSelectedCard( cardId );
		if ( cardId !== undefined ) {
			goToNextStep();
		}
	};

	const handlePlayerSelect = ( playerId: PlayerId | undefined ) => {
		setSelectedPlayer( playerId );
		if ( playerId !== undefined ) {
			goToNextStep();
		}
	};

	const handleClick = () => {
		if ( selectedCard && selectedPlayer ) {
			askCard( { cardId: selectedCard, from: selectedPlayer } );
			closeDrawer();
		}
	};

	return (
		<Drawer open={ open } onOpenChange={ isOpen => !isOpen ? closeDrawer() : setOpen( true ) }>
			<Button onClick={ () => setOpen( true ) }>ASK CARD</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>
						{ currentStep === 1 && "SELECT BOOK TO ASK FROM" }
						{ currentStep === 2 && "SELECT CARD TO ASK" }
						{ currentStep === 3 && "SELECT PLAYER TO ASK FROM" }
						{ currentStep === 4 && confirmTitle.toUpperCase() }
					</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 overflow-y-scroll max-h-100" }>
					{ currentStep === 1 && (
						<RadioSelect
							options={ askableBooks }
							value={ selectedBook }
							onChange={ handleBookSelect }
							className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }
							renderOption={ book => (
								<h1 className={ "text-base md:text-lg xl:text-xl font-semibold" }>
									{ getBookDisplayString( book, data.config.type ) }
								</h1>
							) }
						/>
					) }
					{ currentStep === 2 && !!selectedBook && (
						<RadioSelect
							options={ getMissingCards( hand, selectedBook, data.config.type ) }
							value={ selectedCard }
							onChange={ handleCardSelect }
							className={ "justify-center" }
							renderOption={ cardId => <RCard cardId={ cardId }/> }
						/>
					) }
					{ currentStep === 3 && (
						<RadioSelect
							options={ opponentsWithCards }
							value={ selectedPlayer }
							onChange={ handlePlayerSelect }
							className={ "grid gap-3 grid-cols-3" }
							renderOption={ pid => <RPlayerInfo player={ data.players[ pid ] }/> }
						/>
					) }
				</div>
				<DrawerFooter>
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
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
