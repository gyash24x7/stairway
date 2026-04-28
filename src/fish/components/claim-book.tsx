"use client";

import { useFish } from "@/fish/components/context";
import { claimBook } from "@/fish/core/actions";
import type { Book } from "@/fish/core/types";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	getTeammates
} from "@/fish/core/utils";
import { RCard } from "@/shared/components/card";
import { RPlayerInfo } from "@/shared/components/player-info";
import type { PlayerId } from "@/shared/engine/types";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { type CardId } from "@/shared/utils/cards";
import { cn } from "@/shared/utils/cn";
import { ArrowBigRightDashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useStep } from "usehooks-ts";

export function ClaimBook() {
	const { shared, player } = useFish();

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ claim, setClaim ] = useState( new Map<CardId, PlayerId>() );
	const [ open, setOpen ] = useState( false );

	const teamMates = getTeammates( shared.state.teams, player.playerId );
	const selectedBookDisplayString = selectedBook
		? getBookDisplayString( selectedBook, shared.config.type )
		: "";

	const missingCards = selectedBook
		? getMissingCards( player.hand, selectedBook, shared.config.type )
		: [];

	const allAssigned = selectedBook
		&& claim.size === getCardsOfBook( selectedBook, shared.config.type ).length;

	const openDrawer = () => {
		setOpen( true );
	};

	const closeDrawer = () => {
		setSelectedBook( undefined );
		setClaim( new Map() );
		setOpen( false );
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
			getCardsOfBook( book, shared.config.type, player.hand ).forEach( cardId => {
				newClaim.set( cardId, player.playerId );
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

	const [ isPending, startTransition ] = useTransition();

	const handleClick = () => startTransition( async () => {
		if ( selectedBook && allAssigned ) {
			await claimBook( {
				gameId: shared.id,
				claim: claim.entries().reduce(
					( acc, [ cardId, playerId ] ) => {
						acc[ cardId ] = playerId;
						return acc;
					},
					{} as Record<CardId, PlayerId>
				)
			} );

			closeDrawer();
		}
	} );

	const [ currentStep, { goToNextStep, goToPrevStep, reset } ] = useStep( 3 );

	return (
		<Drawer open={ open } onOpenChange={ isOpen => !isOpen ? closeDrawer() : setOpen( true ) }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>CLAIM BOOK</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>
						{ currentStep === 1 && "SELECT BOOK TO CLAIM" }
						{ currentStep === 2 && "ASSIGN MISSING CARDS TO TEAMMATES" }
						{ currentStep === 3 && `CONFIRM CLAIM FOR ${ selectedBookDisplayString }` }
					</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 overflow-y-auto" }>
					{ currentStep === 1 && (
						<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
							{ Array.from( getBooksInHand( player.hand, shared.config.type ) ).map( ( item ) => (
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
										{ getBookDisplayString( item, shared.config.type ) }
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
													"cursor-pointer border-2 rounded-md bg-background",
													claim.get( cardId ) === pid && "border-accent"
												) }
											>
												<RPlayerInfo
													player={ shared.players[ pid ] }
													selected={ claim.get( cardId ) === pid }
												/>
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
									<RPlayerInfo player={ shared.players[ playerId ] }/>
								</div>
							) ) }
						</div>
					) }
				</div>
				<DrawerFooter>
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
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
