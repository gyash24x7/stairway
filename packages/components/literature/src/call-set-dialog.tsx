import { Button, Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@base/components";
import { useCardSetsInHand, useGameId, useMyTeam, usePlayers } from "@literature/store";
import { CardSet, cardSetMap, PlayingCard } from "@stairway/cards";
import { defineStepper } from "@stepperize/react";
import { Fragment, ReactNode, useCallback, useState } from "react";
import { CallSet } from "./game-actions.tsx";
import { SelectCardSet } from "./select-card-set.tsx";
import { SelectCard } from "./select-card.tsx";

const ActionModal = ( props: { title: string; content: ReactNode; footer: ReactNode; } ) => (
	<Fragment>
		<DrawerHeader>
			<DrawerTitle className={ "text-center" }>{ props.title }</DrawerTitle>
		</DrawerHeader>
		<div className={ "px-4" }>{ props.content }</div>
		<DrawerFooter>{ props.footer }</DrawerFooter>
	</Fragment>
);

const { useStepper } = defineStepper(
	{ id: "SET", title: "Select Card Set" },
	{ id: "LOCATIONS", title: "Select Card Locations" },
	{ id: "CONFIRM", title: "Confirm Call" }
);

export const CallSetDialog = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const cardSets = useCardSetsInHand();
	const team = useMyTeam();

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<string[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string>>( {} );

	const [ showDrawer, setShowDrawer ] = useState( false );

	const openDrawer = useCallback( () => {
		setShowDrawer( true );
	}, [] );

	const closeDrawer = useCallback( () => {
		setSelectedCardSet( undefined );
		setCardOptions( [] );
		setCardMap( {} );
		setShowDrawer( false );
	}, [] );

	const handleCardSetSelect = useCallback( ( value?: string ) => {
		if ( !value ) {
			setSelectedCardSet( undefined );
		} else {
			const cardSet: CardSet = value as CardSet;
			setSelectedCardSet( cardSet );
			setCardOptions( cardSetMap[ cardSet ].map( PlayingCard.from ).map( c => c.id ) );
		}
	}, [] );

	const handleCardSelectForPlayer = ( playerId: string ) => ( cardId: string ) => {
		setCardMap( data => (
			{ ...data, [ cardId ]: playerId }
		) );
	};

	const handleCardDeSelectForPlayer = ( cardId: string ) => {
		setCardMap( data => {
			delete data[ cardId ];
			return { ...data };
		} );
	};

	const getCardsForPlayers = useCallback(
		( playerId: string ) => Object.keys( cardMap ).filter( cardId => cardMap[ cardId ] === playerId ),
		[ cardMap ]
	);

	const stepper = useStepper();


	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>CALL SET</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					{ stepper.when( "SET", () => (
						<ActionModal
							title={ "Select Card Set to Call" }
							content={
								<SelectCardSet
									cardSet={ selectedCardSet }
									handleSelection={ handleCardSetSelect }
									cardSetOptions={ Array.from( cardSets ) }
								/>
							}
							footer={
								<Button onClick={ stepper.next } disabled={ !selectedCardSet }>
									SELECT CARD SET
								</Button>
							}
						/>
					) ) }
					{ stepper.when( "LOCATIONS", () => (
						<ActionModal
							title={ "Select Card Locations" }
							content={
								<div className={ "flex flex-col gap-3" }>
									{ team!.memberIds.map( playerId => players[ playerId ] ).map( player => (
										<Fragment key={ player.id }>
											<h1>Cards With { player.name }</h1>
											<div className={ "overflow-x-scroll" }>
												<SelectCard
													cards={ cardOptions.map( PlayingCard.fromId ) }
													selectedCards={ getCardsForPlayers( player.id ) }
													onSelect={ handleCardSelectForPlayer( player.id ) }
													onDeselect={ handleCardDeSelectForPlayer }
												/>
											</div>
										</Fragment>
									) ) }
								</div>
							}
							footer={
								<div className={ "flex gap-3" }>
									<Button onClick={ stepper.prev } className={ "flex-1" }>BACK</Button>
									<Button onClick={ stepper.next } className={ "flex-1" }>NEXT</Button>
								</div>
							}
						/>
					) ) }
					{ stepper.when( "CONFIRM", () => (
						<ActionModal
							title={ `Confirm Call for ${ selectedCardSet }` }
							content={
								<div className={ "flex flex-col gap-3" }>
									{ Object.keys( cardMap ).map( cardId => (
										<h3 key={ cardId } className={ "text-center" }>
											{ PlayingCard.fromId( cardId ).displayString } is
											with { players[ cardMap[ cardId ] ].name }
										</h3>
									) ) }
								</div>
							}
							footer={
								<div className={ "w-full flex gap-3" }>
									<Button onClick={ stepper.prev } className={ "flex-1" }>BACK</Button>
									<CallSet gameId={ gameId } data={ cardMap } onSubmit={ closeDrawer }/>
								</div>
							}
						/>
					) ) }
				</div>
			</DrawerContent>
		</Drawer>
	);
};
