"use client";

import { useFish } from "@/fish/components/context";
import { claimBook } from "@/fish/core/actions";
import type { Book } from "@/fish/core/types";
import { getBookDisplayString, getBooksInHand, getCardsOfBook, getMissingCards, getTeammates } from "@/fish/core/utils";
import { RCard } from "@/shared/components/card";
import { RPlayerInfo } from "@/shared/components/player-info";
import type { PlayerId } from "@/shared/engine/types";
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
import { type CardId } from "@/shared/utils/cards";
import { cn } from "@/shared/utils/cn";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowBigRightDashIcon } from "lucide-react";
import { useState } from "react";
import { useStep } from "usehooks-ts";

export function ClaimBook() {
	const { game } = useFish();

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ claim, setClaim ] = useState( new Map<CardId, PlayerId>() );
	const [ showDialog, setShowDialog ] = useState( false );

	const teamMates = getTeammates( game.state.teams, game.state.playerId );
	const selectedBookDisplayString = selectedBook ? getBookDisplayString( selectedBook, game.config.type ) : "";

	const missingCards = selectedBook
		? getMissingCards( game.state.hand, selectedBook, game.config.type )
		: [];

	const allAssigned = selectedBook
		&& claim.size === getCardsOfBook( selectedBook, game.config.type ).length;

	const openDialog = () => {
		setShowDialog( true );
	};

	const closeDialog = () => {
		setSelectedBook( undefined );
		setClaim( new Map() );
		setShowDialog( false );
		reset();
	};

	const handleBookSelect = ( value?: string ) => () => {
		if ( !value ) {
			setSelectedBook( undefined );
			setClaim( new Map() );
		} else {
			const book = value as Book;
			setSelectedBook( book );
			const newClaim = new Map<CardId, PlayerId>();
			getCardsOfBook( book, game.config.type, game.state.hand ).forEach( cardId => {
				newClaim.set( cardId, game.state.playerId );
			} );
			setClaim( newClaim );
			goToNextStep();
		}
	};

	const handleAssignCard = ( cardId: CardId, playerId: PlayerId ) => () => {
		setClaim( prev => {
			const next = new Map( prev );
			if ( next.get( cardId ) === playerId ) {
				next.delete( cardId );
			} else {
				next.set( cardId, playerId );
			}
			return next;
		} );
	};

	const claimBookFn = useServerFn( claimBook );
	const { isPending, mutate } = useMutation( {
		mutationFn: claimBookFn,
		onSuccess: () => closeDialog()
	} );

	const handleClick = () => {
		if ( selectedBook && allAssigned ) {
			mutate( {
				data: {
					gameId: game.id,
					claim: claim.entries().reduce(
						( acc, [ cardId, playerId ] ) => {
							acc[ cardId ] = playerId;
							return acc;
						},
						{} as Record<CardId, PlayerId>
					)
				}
			} );
		}
	};

	const [ currentStep, { goToNextStep, goToPrevStep, reset } ] = useStep( 3 );

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<Button onClick={ openDialog } className={ "flex-1 max-w-lg" }>CLAIM BOOK</Button>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>
						{ currentStep === 1 && "SELECT BOOK TO CLAIM" }
						{ currentStep === 2 && "ASSIGN MISSING CARDS TO TEAMMATES" }
						{ currentStep === 3 && `CONFIRM CLAIM FOR ${ selectedBookDisplayString }` }
					</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				{ currentStep === 1 && (
					<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
						{ Array.from( getBooksInHand( game.state.hand, game.config.type ) ).map( ( item ) => (
							<div
								key={ item }
								onClick={ handleBookSelect( selectedBook === item ? undefined : item ) }
								className={ cn(
									"cursor-pointer rounded-md border-2 px-2 md:px-4 py-1 md:py-2",
									"flex justify-center bg-background",
									selectedBook === item && "border-accent bg-accent/20"
								) }
							>
								<h1 className={ "text-md md:text-lg xl:text-xl font-semibold" }>
									{ getBookDisplayString( item, game.config.type ) }
								</h1>
							</div>
						) ) }
					</div>
				) }
				{ currentStep === 2 && (
					<div className={ "flex flex-col gap-3" }>
						{ missingCards.map( cardId => (
							<div key={ cardId } className={ "flex items-center gap-2" }>
								<RCard cardId={ cardId }/>
								<ArrowBigRightDashIcon className={ "w-10 h-10 text-accent" }/>
								<div className={ "flex gap-2 flex-wrap" }>
									{ teamMates.map( pid => (
										<div
											key={ pid }
											onClick={ handleAssignCard( cardId, pid ) }
											className={ cn(
												"cursor-pointer border-2 rounded-md px-2 py-1 bg-background",
												claim.get( cardId ) === pid && "border-accent bg-accent/20"
											) }
										>
											<RPlayerInfo player={ game.players[ pid ] }/>
										</div>
									) ) }
								</div>
							</div>
						) ) }
						{ missingCards.length === 0 && (
							<p className={ "text-sm text-center opacity-60" }>
								YOU HOLD ALL CARDS IN THIS BOOK
							</p>
						) }
					</div>
				) }
				{ currentStep === 3 && (
					<div className={ "grid grid-cols-2 gap-2" }>
						{ [ ...claim.entries() ].map( ( [ cardId, playerId ] ) => (
							<div key={ cardId } className={ "flex items-center rounded-md px-3 py-2 gap-2" }>
								<RCard cardId={ cardId }/>
								<ArrowBigRightDashIcon className={ "w-10 h-10 text-accent" }/>
								<RPlayerInfo player={ game.players[ playerId ] }/>
							</div>
						) ) }
					</div>
				) }
				<DialogFooter>
					{ currentStep === 1 && (
						<Button onClick={ goToNextStep } disabled={ !selectedBook } className={ "w-full" }>
							SELECT BOOK
						</Button>
					) }
					{ currentStep === 2 && (
						<div className={ "w-full flex gap-3" }>
							<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
							<Button onClick={ goToNextStep } disabled={ !allAssigned } className={ "flex-1" }>
								NEXT
							</Button>
						</div>
					) }
					{ currentStep === 3 && (
						<div className={ "w-full flex gap-3" }>
							<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
							<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
								{ isPending ? <Spinner/> : "CLAIM BOOK" }
							</Button>
						</div>
					) }
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
