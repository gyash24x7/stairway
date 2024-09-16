"use client";

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, Spinner } from "@base/ui";
import { Player } from "@literature/api";
import { CardSet, cardSetMap, PlayingCard } from "@stairway/cards";
import { defineStepper } from "@stepperize/react";
import { Fragment, useCallback, useState } from "react";
import { useServerAction } from "zsa-react";
import { callSetAction } from "../actions";
import { useCardSetsInHand, useGameId, useMyTeam, usePlayers } from "../store";
import { SelectCard } from "./select-card";
import { SelectCardSet, SelectCardSetProps } from "./select-card-set";

type UpdatePaneStateProps = {
	next?: () => void;
	back?: () => void;
}

const SelectCardSetDialogContent = ( props: SelectCardSetProps & UpdatePaneStateProps ) => (
	<Fragment>
		<DialogHeader>Select CardSet to Call</DialogHeader>
		<div>
			<SelectCardSet
				cardSetOptions={ props.cardSetOptions }
				handleSelection={ props.handleSelection }
				cardSet={ props.cardSet }
			/>
		</div>
		<DialogFooter>
			<Button className={ "w-full" } onClick={ props.next }
					disabled={ !props.cardSet }>
				SELECT CARD SET
			</Button>
		</DialogFooter>
	</Fragment>
);

type SelectCardLocationProps = {
	players: Player[];
	cardMap: Record<string, string>;
	cardOptions: PlayingCard[];
	onCardSelect: ( playerId: string ) => ( cardId: string ) => void;
	onCardDeselect: ( cardId: string ) => void;
}

const SelectCardLocationsDialogContent = ( props: SelectCardLocationProps & UpdatePaneStateProps ) => {

	const getCardsForPlayers = useCallback(
		( playerId: string ) => Object.keys( props.cardMap ).filter( cardId => props.cardMap[ cardId ] === playerId ),
		[ props.cardMap ]
	);

	return (
		<Fragment>
			<DialogHeader>Select Card Locations</DialogHeader>
			<div className={ "flex flex-col gap-3 overflow-x-scroll" }>
				{ props.players.map( player => (
					<Fragment key={ player.id }>
						<h1>Cards With { player.name }</h1>
						<SelectCard
							cards={ props.cardOptions }
							selectedCards={ getCardsForPlayers( player.id ) }
							onSelect={ props.onCardSelect( player.id ) }
							onDeselect={ props.onCardDeselect }
						/>
					</Fragment>
				) ) }
			</div>
			<DialogFooter>
				<div className={ "flex gap-3" }>
					<Button className={ "w-full" } onClick={ props.next }>
						BACK
					</Button>
					<Button className={ "w-full" } onClick={ props.next }>
						NEXT
					</Button>
				</div>
			</DialogFooter>
		</Fragment>
	);
};

type ConfirmCallProps = {
	isPending?: boolean;
	cardSet: CardSet;
	cardMap: Record<string, string>
	players: Record<string, Player>;
	onConfirmCall: () => void
}

const ConfirmCallDialogContent = ( { cardMap, players, ...props }: ConfirmCallProps & UpdatePaneStateProps ) => (
	<Fragment>
		<DialogHeader>Confirm Call for { props.cardSet }</DialogHeader>
		<div>
			<div className={ "flex flex-col gap-3" }>
				{ Object.keys( cardMap ).map( cardId => (
					<h3 key={ cardId }>
						{ PlayingCard.fromId( cardId ).displayString } is with { players[ cardMap[ cardId ] ].name }
					</h3>
				) ) }
			</div>
		</div>
		<DialogFooter>
			<div className={ "w-full flex gap-3" }>
				<Button className={ "w-full" } onClick={ props.next }>
					BACK
				</Button>
				<Button className={ "w-full" } onClick={ props.onConfirmCall }>
					{ props.isPending ? <Spinner/> : "CONFIRM CALL" }
				</Button>
			</div>
		</DialogFooter>
	</Fragment>
);

export const CallSet = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const cardSets = useCardSetsInHand();
	const team = useMyTeam();

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<string[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string>>( {} );

	const [ showDialog, setShowDialog ] = useState( false );

	const openDialog = useCallback( () => {
		setShowDialog( true );
	}, [] );

	const closeDialog = useCallback( () => {
		setSelectedCardSet( undefined );
		setCardOptions( [] );
		setCardMap( {} );
		setShowDialog( false );
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

	const stepper = useStepper();

	const { isPending, execute } = useServerAction( callSetAction, {
		onFinish: () => closeDialog()
	} );

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<Button onClick={ openDialog }>CALL SET</Button>
			<DialogContent>
				{ stepper.when( "SET", () => (
					<SelectCardSetDialogContent
						cardSet={ selectedCardSet }
						handleSelection={ handleCardSetSelect }
						cardSetOptions={ Array.from( cardSets ) }
						next={ stepper.next }
					/>
				) ) }
				{ stepper.when( "LOCATIONS", () => (
					<SelectCardLocationsDialogContent
						players={ team!.memberIds.map( playerId => players[ playerId ] ) }
						cardMap={ cardMap }
						cardOptions={ cardOptions.map( PlayingCard.fromId ) }
						onCardSelect={ handleCardSelectForPlayer }
						onCardDeselect={ handleCardDeSelectForPlayer }
						next={ stepper.next }
						back={ stepper.prev }
					/>
				) ) }
				{ stepper.when( "CONFIRM", () => (
					<ConfirmCallDialogContent
						isPending={ isPending }
						cardSet={ selectedCardSet! }
						cardMap={ cardMap }
						players={ players }
						onConfirmCall={ () => execute( { gameId, data: cardMap } ) }
						back={ stepper.prev }
					/>
				) ) }
			</DialogContent>
		</Dialog>
	);
};

const { useStepper } = defineStepper(
	{ id: "SET", title: "Select Card Set" },
	{ id: "LOCATIONS", title: "Select Card Locations" },
	{ id: "CONFIRM", title: "Confirm Call" }
);