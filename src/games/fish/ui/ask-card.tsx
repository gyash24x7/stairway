import * as Exit from "effect/Exit";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useState } from "react";
import { useStep } from "usehooks-ts";

import type { Book, FishConfig, FishView } from "@/games/fish/schema";
import { askCardAtom } from "@/games/fish/ui/client";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards
} from "@/games/fish/utils";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { toast } from "@/shared/primitives/sonner";
import { Spinner } from "@/shared/primitives/spinner";
import { RCard } from "@/shared/shell/card";
import { causeMessage } from "@/shared/shell/errors";
import type { CardId } from "@/shared/utils/cards";
import { getCardDisplayString } from "@/shared/utils/cards";
import type { GameView, PlayerId } from "@/swish/schema";
import { GameId } from "@/swish/schema";
import { RPlayerInfo } from "@/swish/ui/player-info";
import { opponentsOf } from "@/swish/utils";


export type AskCardProps = {
	readonly game: GameView<FishView, FishConfig>;
	readonly me: PlayerId;
	readonly gameId: string;
};

export function AskCard( { game, me, gameId }: AskCardProps ) {
	const ask = useAtomSet( askCardAtom, { mode: "promiseExit" } );
	const isPending = useAtomValue( askCardAtom ).waiting;

	const hand = game.view.hand;

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<PlayerId>();
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	// A book you already hold in full is not askable — there is nothing missing.
	const askableBooks = getBooksInHand( hand, game.config.type )
		.filter( book => getCardsOfBook( book, hand ).length !== game.config.bookSize );

	const opponentsWithCards = opponentsOf( game.context, me )
		.filter( playerId => ( game.view.cardCounts[ playerId ] ?? 0 ) > 0 );

	const confirmTitle = selectedPlayer && selectedCard
		? `Ask ${ game.players[ selectedPlayer ]?.name } for ${ getCardDisplayString( selectedCard ) }`
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

	const handleClick = async () => {
		if ( !selectedCard || !selectedPlayer ) {
			return;
		}

		const exit = await ask( {
			params: { gameId: GameId.make( gameId ) },
			payload: { cardId: selectedCard, from: selectedPlayer }
		} );

		if ( Exit.isFailure( exit ) ) {
			toast.error( causeMessage( exit.cause ) );
			return;
		}

		closeDrawer();
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
									{ getBookDisplayString( book, game.config.type ) }
								</h1>
							) }
						/>
					) }
					{ currentStep === 2 && !!selectedBook && (
						<RadioSelect
							options={ getMissingCards( hand, selectedBook, game.config.type ) }
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
							renderOption={ pid => {
								const player = game.players[ pid ];
								return player ? <RPlayerInfo player={ player }/> : null;
							} }
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
