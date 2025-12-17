import { Button } from "@s2h-ui/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@s2h-ui/primitives/drawer";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCard } from "@s2h-ui/shared/display-card";
import { useClaimBookMutation } from "@s2h/client/fish";
import type { Book, PlayerId } from "@s2h/fish/types";
import { getBooksInHand, getCardsOfBook } from "@s2h/fish/utils";
import { type CardId, getCardDisplayString } from "@s2h/utils/cards";
import { useStore } from "@tanstack/react-store";
import { Fragment, useState } from "react";
import { useStep } from "usehooks-ts";
import { store } from "./store.tsx";

export function ClaimBook() {
	const gameId = useStore( store, state => state.id );
	const hand = useStore( store, state => state.hand );
	const player = useStore( store, state => state.players[ state.playerId ] );
	const players = useStore( store, state => state.players );
	const bookType = useStore( store, state => state.config.type );

	const [ selectedBook, setSelectedBook ] = useState<Book>();
	const [ cardOptions, setCardOptions ] = useState<CardId[]>( [] );
	const [ claim, setClaim ] = useState( new Map<CardId, PlayerId>() );
	const [ showDrawer, setShowDrawer ] = useState( false );

	const { mutateAsync, isPending } = useClaimBookMutation( {
		onSettled: () => closeDrawer()
	} );

	const openDrawer = () => {
		setShowDrawer( true );
	};

	const closeDrawer = () => {
		setSelectedBook( undefined );
		setCardOptions( [] );
		setClaim( new Map() );
		setShowDrawer( false );
	};

	const handleBookSelect = ( value?: string ) => () => {
		if ( !value ) {
			setSelectedBook( undefined );
		} else {
			const book = value as Book;
			setSelectedBook( book );
			setCardOptions( getCardsOfBook( book, bookType ) );
			setClaim( data => {
				getCardsOfBook( book, bookType, hand ).forEach( cardId => {
					data.set( cardId, player.id );
				} );
				return data;
			} );
			goToNextStep();
		}
	};

	const handleCardSelectForPlayer = ( cardId: CardId, playerId?: string ) => () => {
		if ( !playerId ) {
			setClaim( data => {
				data.delete( cardId );
				return data;
			} );
		} else {
			setClaim( data => {
				data.set( cardId, playerId );
				return data;
			} );
		}
	};

	const handleClick = () => mutateAsync( {
		gameId,
		claim: claim.entries().reduce(
			( acc, [ cardId, playerId ] ) => {
				acc[ cardId ] = playerId;
				return acc;
			},
			{} as Record<CardId, PlayerId>
		)
	} );

	const [ currentStep, { goToNextStep, goToPrevStep } ] = useStep( 3 );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>CLAIM BOOK</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg overscroll-y-auto" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>
							{ currentStep === 1 && "Select Book to Claim".toUpperCase() }
							{ currentStep === 2 && "Select Card Locations".toUpperCase() }
							{ currentStep === 3 && `Confirm Claim for ${ selectedBook }`.toUpperCase() }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						{ currentStep === 1 && (
							<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
								{ Array.from( getBooksInHand( hand, bookType ) ).map( ( item ) => (
									<div
										key={ item }
										onClick={ handleBookSelect( selectedBook === item ? undefined : item ) }
										className={ cn(
											selectedBook === item ? "bg-white" : "bg-bg",
											"cursor-pointer rounded-md border-2 px-2 md:px-4 py-1 md:py-2",
											"flex justify-center"
										) }
									>
										<div className={ "flex gap-2 md:gap-3 items-center" }>
											<h1
												className={ cn(
													"text-gray-800",
													"text-md md:text-lg xl:text-xl font-semibold"
												) }
											>
												{ item }
											</h1>
										</div>
									</div>
								) ) }
							</div>
						) }
						{ currentStep === 2 && (
							<div className={ "flex flex-col gap-3" }>
								{ player.teamMates.map( playerId => players[ playerId ] ).map( player => (
									<Fragment key={ player.id }>
										<h1>Cards With { player.name }</h1>
										<div className={ "grid gap-3 grid-cols-6" }>
											{ cardOptions.map( ( cardId ) => (
												<div
													key={ cardId }
													onClick={ handleCardSelectForPlayer(
														cardId,
														claim.get( cardId ) === player.id ? undefined : player.id
													) }
													className={ "cursor-pointer rounded-md flex justify-center" }
												>
													<DisplayCard
														cardId={ cardId }
														focused={ claim.get( cardId ) === player.id }
													/>
												</div>
											) ) }
										</div>
									</Fragment>
								) ) }
							</div>
						) }
						{ currentStep === 3 && (
							<div className={ "flex flex-col gap-3" }>
								{ claim.entries().map( ( [ cardId, playerId ] ) => (
									<h3 key={ cardId } className={ "text-center" }>
										{ getCardDisplayString( cardId ) } is with { players[ playerId ].name }
									</h3>
								) ) }
							</div>
						) }
					</div>
					<DrawerFooter>
						{ currentStep === 1 && (
							<Button onClick={ goToNextStep } disabled={ !selectedBook }>
								SELECT CARD SET
							</Button>
						) }
						{ currentStep === 2 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ goToNextStep } className={ "flex-1" }>NEXT</Button>
							</div>
						) }
						{ currentStep === 3 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
									{ isPending ? <Spinner/> : "CALL SET" }
								</Button>
							</div>
						) }
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
