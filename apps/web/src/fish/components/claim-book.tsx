"use client";

import { orpc } from "@s2h/client/query";
import { useFish } from "@/fish/components/context";
import type { Book } from "@s2h/fish-core/types";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	getTeammates
} from "@s2h/fish-core/utils";
import { RCard } from "@/shared/components/card";
import { RPlayerInfoStrip } from "@/shared/components/player-info";
import type { PlayerId } from "@s2h/engine/types";
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
import { Spinner } from "@/shared/primitives/spinner";
import { type CardId } from "@s2h/shared/utils/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowBigRightDashIcon } from "lucide-react";
import { useState } from "react";
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

	const handleBookSelect = ( book: Book | undefined ) => {
		if ( !book ) {
			setSelectedBook( undefined );
			setClaim( new Map() );
		} else {
			setSelectedBook( book );
			const newClaim = new Map<CardId, PlayerId>();
			getCardsOfBook( book, shared.config.type, player.hand ).forEach( cardId => {
				newClaim.set( cardId, player.playerId );
			} );
			setClaim( newClaim );
			goToNextStep();
		}
	};

	const handleAssignCard = ( cardId: CardId ) => ( pid: PlayerId | undefined ) => {
		setClaim( prev => {
			const next = new Map( prev );
			if ( pid === undefined ) {
				next.delete( cardId );
			} else {
				next.set( cardId, pid );
			}
			return next;
		} );
	};

	const queryClient = useQueryClient();

	const claimBook = useMutation( orpc.fish.claimBook.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.fish.getGame.key( { input: { gameId: shared.id } } )
		} )
	} ) );

	const handleClick = async () => {
		if ( selectedBook && allAssigned ) {
			await claimBook.mutateAsync( {
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
	};

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
						<RadioSelect
							options={ Array.from( getBooksInHand( player.hand, shared.config.type ) ) }
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
						<div className={ "grid grid-cols-2 gap-2 flex-wrap" }>
							{ missingCards.map( cardId => (
								<div key={ cardId } className={ "flex items-center gap-1" }>
									<RCard cardId={ cardId } small/>
									<ArrowBigRightDashIcon className={ "w-6 h-6 md:w-8 md:h-8 text-accent" }/>
									<RadioSelect
										options={ teamMates }
										value={ claim.get( cardId ) }
										onChange={ handleAssignCard( cardId ) }
										className={ "flex flex-col gap-2 flex-wrap child-b-0" }
										renderOption={ pid => <RPlayerInfoStrip player={ shared.players[ pid ] }/> }
									/>
								</div>
							) ) }
							{ missingCards.length === 0 && (
								<div className={ "col-span-2" }>
									<p className={ "text-sm text-center opacity-60" }>
										YOU HOLD ALL CARDS IN THIS BOOK
									</p>
								</div>
							) }
						</div>
					) }
					{ currentStep === 3 && (
						<div className={ "grid grid-cols-3 gap-2" }>
							{ [ ...claim.entries() ].map( ( [ cardId, playerId ] ) => (
								<div
									key={ cardId }
									className={ "flex flex-col items-center rounded-md gap-1 md:gap-2" }
								>
									<RPlayerInfoStrip player={ shared.players[ playerId ] } noAvatar/>
									<RCard cardId={ cardId } small/>
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
							<Button onClick={ handleClick } disabled={ claimBook.isPending } className={ "flex-1" }>
								{ claimBook.isPending ? <Spinner/> : "CLAIM BOOK" }
							</Button>
						</div>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
