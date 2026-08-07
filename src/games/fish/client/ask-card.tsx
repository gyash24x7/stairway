"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useStep } from "usehooks-ts";

import type { AskCardInput, Book } from "@/games/fish/shared/schema.ts";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	getOpponents
} from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import { getCardDisplayString } from "@/shared/cards/utils.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { RCard } from "@/shared/ui/components/card.tsx";
import { RPlayerInfo } from "@/shared/ui/components/player-info.tsx";
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
import { askCardFn } from "@/games/fish/client/client.ts";
import { useFish } from "@/games/fish/client/context.tsx";

export function AskCard() {
	const { data } = useFish();
	const player = data.view;

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<PlayerId>();
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	const askableBooks = Array.from( getBooksInHand( player.hand, data.config.type ) )
		.filter( book => {
			const cards = getCardsOfBook( book, player.hand );
			return cards.length !== data.config.bookSize;
		} );

	const opponentsWithCards = getOpponents( data.view.teams, player.playerId )
		.map( memberId => ( { ...data.players[ memberId ], ...data.view.playerData[ memberId ] } ) )
		.filter( member => !!data.view.cardCounts[ member.id ] );

	const confirmAskDialogTitle = selectedPlayer && selectedCard
		? `Ask ${ data.players[ selectedPlayer ].name } for ${ getCardDisplayString( selectedCard ) }`
		: "";

	const openDialog = () => setOpen( true );

	const handleBookSelect = ( value: Book | undefined ) => {
		setSelectedBook( value );
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

	const handlePlayerSelect = ( pid: PlayerId | undefined ) => {
		setSelectedPlayer( pid );
		if ( pid !== undefined ) {
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

	const queryClient = useQueryClient();

	const askCard = useMutation( {
		mutationFn: ( input: AskCardInput ) => askCardFn( data.id, input ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", data.id ]
		} )
	} );

	const handleClick = async () => {
		if ( selectedCard && selectedPlayer ) {
			await askCard.mutateAsync( { cardId: selectedCard, from: selectedPlayer } );
			closeDialog();
		}
	};

	return (
		<Drawer open={ open } onOpenChange={ isOpen => !isOpen ? closeDialog() : setOpen( true ) }>
			<Button onClick={ openDialog } className={ "flex-1 max-w-lg" }>ASK CARD</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>
						{ currentStep === 1 && "Select Book to Ask from".toUpperCase() }
						{ currentStep === 2 && "Select Card to Ask".toUpperCase() }
						{ currentStep === 3 && "Select Player to Ask from".toUpperCase() }
						{ currentStep === 4 && confirmAskDialogTitle.toUpperCase() }
					</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 overflow-y-auto" }>
					{ currentStep === 1 && (
						<RadioSelect
							options={ askableBooks }
							value={ selectedBook }
							onChange={ handleBookSelect }
							className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }
							renderOption={ ( book ) => (
								<h1 className={ "text-md md:text-lg xl:text-xl font-semibold" }>
									{ getBookDisplayString( book, data.config.type ) }
								</h1>
							) }
						/>
					) }
					{ currentStep === 2 && (
						<RadioSelect
							options={ getMissingCards( player.hand, selectedBook!, data.config.type ) }
							value={ selectedCard }
							onChange={ handleCardSelect }
							className={ "justify-center" }
							renderOption={ ( cardId ) => <RCard cardId={ cardId }/> }
						/>
					) }
					{ currentStep === 3 && (
						<RadioSelect
							options={ opponentsWithCards.map( p => p.id ) }
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
							<Button onClick={ handleClick } disabled={ askCard.isPending } className={ "flex-1" }>
								{ askCard.isPending ? <Spinner/> : "ASK CARD" }
							</Button>
						</div>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
