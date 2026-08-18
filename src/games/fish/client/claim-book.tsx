"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { useStep } from "usehooks-ts";

import { useFish } from "@/games/fish/client/context.tsx";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards
} from "@/games/fish/shared/utils.ts";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/shared/ui/primitives/table.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RPlayerInfoStrip } from "@/swish/client/player-info.tsx";
import { membersOf, teamOf } from "@/swish/shared/teams.ts";

import type { Book } from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

export function ClaimBook() {
	const { data, claimBook, isPending } = useFish();
	const me = data.view.playerId;
	const hand = data.view.hand;

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ claim, setClaim ] = useState( new Map<CardId, PlayerId>() );
	const [ open, setOpen ] = useState( false );
	const [ currentStep, { goToNextStep, goToPrevStep, reset } ] = useStep( 3 );

	// A declaration names a holder for every card of the book, and only this side
	// can hold them if the declaration is to be right — so the side is the roster.
	const myTeam = teamOf( data.context, me );
	const side = myTeam === undefined ? [ me ] : membersOf( data.context, myTeam );

	const bookLabel = selectedBook
		? getBookDisplayString( selectedBook, data.config.type )
		: "";

	const missingCards = selectedBook
		? getMissingCards( hand, selectedBook, data.config.type )
		: [];

	const allAssigned = !!selectedBook
		&& claim.size === getCardsOfBook( selectedBook ).length;

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
			return;
		}

		// Seed the claim with what you can see: your own cards are not in doubt.
		const seeded = new Map<CardId, PlayerId>();
		for ( const cardId of getCardsOfBook( book, hand ) ) {
			seeded.set( cardId, me );
		}

		setSelectedBook( book );
		setClaim( seeded );
		goToNextStep();
	};

	const handleAssignCard = ( cardId: CardId, playerId: PlayerId ) => {
		setClaim( prev => {
			const next = new Map( prev );
			const current = next.get( cardId );
			if ( playerId === current ) {
				next.delete( cardId );
			} else {
				next.set( cardId, playerId );
			}
			return next;
		} );
	};

	const handleClick = () => {
		if ( !selectedBook || !allAssigned ) {
			return;
		}

		const assignment: Record<string, PlayerId> = {};
		for ( const [ cardId, playerId ] of claim ) {
			assignment[ cardId ] = playerId;
		}

		claimBook( { claim: assignment }, closeDrawer );
	};

	return (
		<Drawer open={ open } onOpenChange={ isOpen => !isOpen ? closeDrawer() : setOpen( true ) }>
			<Button onClick={ () => setOpen( true ) }>CLAIM BOOK</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>
						{ currentStep === 1 && "SELECT BOOK TO CLAIM" }
						{ currentStep === 2 && "ASSIGN MISSING CARDS TO TEAMMATES" }
						{ currentStep === 3 && `CONFIRM CLAIM FOR ${ bookLabel }` }
					</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 overflow-y-scroll max-h-100" }>
					{ currentStep === 1 && (
						<RadioSelect
							options={ getBooksInHand( hand, data.config.type ) }
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
					{ currentStep === 2 && (
						<div className={ "flex flex-col gap-2 flex-wrap" }>
							{ missingCards.length !== 0 && (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className={ "text-center" }>CARD</TableHead>
											{ side.map( pid => (
												<TableHead key={ pid } className={ "text-center w-1/4" }>
													{ data.players[ pid ].name }
												</TableHead>
											) ) }
										</TableRow>
									</TableHeader>
									<TableBody>
										{ missingCards.map( cardId => (
											<TableRow key={ cardId }>
												<TableCell>
													<div className={ "min-w-6 min-h-6 justify-self-center" }>
														<RCard cardId={ cardId } small/>
													</div>
												</TableCell>
												{ side.map( pid => (
													<TableCell
														key={ pid }
														onClick={ () => handleAssignCard( cardId, pid ) }
														className={ cn(
															"cursor-pointer",
															"hover:bg-accent/20 transition rounded-md"
														) }
													>
														{ claim.get( cardId ) === pid && (
															<CheckIcon className={ "w-8 h-8 justify-self-center" }/>
														) }
													</TableCell>
												) ) }
											</TableRow>
										) ) }
									</TableBody>
								</Table>
							) }
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
