"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowBigRightDashIcon } from "lucide-react";
import { useState } from "react";
import { useStep } from "usehooks-ts";

import { useAuth } from "@/auth/client/use-auth.tsx";
import type { Book, ClaimBookInput } from "@/games/fish/shared/schema.ts";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	getTeammates
} from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { RCard } from "@/shared/ui/components/card.tsx";
import { RPlayerInfoStrip } from "@/shared/ui/components/player-info.tsx";
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
import { claimBookFn } from "@/games/fish/client/client.ts";
import { useFish } from "@/games/fish/client/context.tsx";

export function ClaimBook() {
	const { data } = useFish();
	const { authInfo } = useAuth();
	const player = data.view;

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ claim, setClaim ] = useState( new Map<CardId, PlayerId>() );
	const [ open, setOpen ] = useState( false );

	const teamMates = getTeammates( data.view.teams, player.playerId );
	const selectedBookDisplayString = selectedBook
		? getBookDisplayString( selectedBook, data.config.type )
		: "";

	const missingCards = selectedBook
		? getMissingCards( player.hand, selectedBook, data.config.type )
		: [];

	const allAssigned = selectedBook
		&& claim.size === getCardsOfBook( selectedBook, data.config.type ).length;

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
			getCardsOfBook( book, data.config.type, player.hand ).forEach( cardId => {
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

	const claimBook = useMutation( {
		mutationFn: ( input: ClaimBookInput ) => claimBookFn( data.id, input ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", data.id ]
		} )
	} );

	const handleClick = async () => {
		if ( selectedBook && allAssigned && authInfo ) {
			await claimBook.mutateAsync( {
				claim: claim.entries().reduce(
					( acc, [ cardId, playerId ] ) => {
						acc[ cardId ] = playerId;
						return acc;
					},
					{} as Record<string, PlayerId>
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
							options={ Array.from( getBooksInHand( player.hand, data.config.type ) ) }
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
										renderOption={ pid => <RPlayerInfoStrip player={ data.players[ pid ] }/> }
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
									<RPlayerInfoStrip player={ data.players[ playerId ] } noAvatar/>
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
							<Button onClick={ handleClick } disabled={ claimBook.isPending }
							        className={ "flex-1" }>
								{ claimBook.isPending ? <Spinner/> : "CLAIM BOOK" }
							</Button>
						</div>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
