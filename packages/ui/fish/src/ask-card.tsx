"use client";

import { orpc } from "@s2h/client/query";
import type { Book } from "@s2h/fish/types";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	getOpponents
} from "@s2h/fish/utils";
import { RCard } from "@s2h/ui/components/card";
import { RPlayerInfo } from "@s2h/ui/components/player-info";
import { Button } from "@s2h/ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { RadioSelect } from "@s2h/ui/primitives/radio-select";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { type CardId, getCardDisplayString } from "@s2h/utils/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useStep } from "usehooks-ts";
import { useFish } from "./context";

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

	const handlePlayerSelect = ( pid: string | undefined ) => {
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

	const askCard = useMutation( orpc.fish.askCard.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.fish.getGame.key( { input: { gameId: shared.id } } )
		} )
	} ) );

	const handleClick = async () => {
		if ( selectedCard && selectedPlayer ) {
			await askCard.mutateAsync( {
				gameId: shared.id,
				cardId: selectedCard,
				from: selectedPlayer
			} );
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
									{ getBookDisplayString( book, shared.config.type ) }
								</h1>
							) }
						/>
					) }
					{ currentStep === 2 && (
						<RadioSelect
							options={ getMissingCards( player.hand, selectedBook!, shared.config.type ) }
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
							renderOption={ pid => <RPlayerInfo player={ shared.players[ pid ] }/> }
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
