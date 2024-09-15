"use client";

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Spinner } from "@base/ui";
import { Player } from "@literature/api";
import { CardSet, PlayingCard } from "@stairway/cards";
import { defineStepper } from "@stepperize/react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useServerAction } from "zsa-react";
import { askCardAction } from "../actions";
import { useCardCounts, useCardSetsInHand, useGameId, useHand, useOppositeTeam, usePlayers } from "../store";
import { SelectCard, SelectCardProps } from "./select-card";
import { SelectCardSet, SelectCardSetProps } from "./select-card-set";
import { SelectPlayer, SelectPlayerProps } from "./select-player";

type StepperProps = {
	next?: () => void;
	back?: () => void;
}

const SelectCardSetModalContent = ( { next, ...props }: SelectCardSetProps & StepperProps ) => (
	<Fragment>
		<DialogHeader>
			<DialogTitle>Select CardSet to Ask</DialogTitle>
		</DialogHeader>
		<div>
			<SelectCardSet { ...props } />
		</div>
		<DialogFooter>
			<Button className={ "w-full" } onClick={ next } disabled={ !props.cardSet }>
				SELECT CARD SET
			</Button>
		</DialogFooter>
	</Fragment>
);

const SelectCardModalContent = ( { next, back, ...props }: SelectCardProps & StepperProps ) => (
	<Fragment>
		<DialogHeader>
			<DialogTitle>Select Card to Ask</DialogTitle>
		</DialogHeader>
		<div>
			<SelectCard { ...props } />
		</div>
		<DialogFooter>
			<div className={ "w-full flex gap-3" }>
				<Button className={ "w-full" } onClick={ back }>
					BACK
				</Button>
				<Button className={ "w-full" } onClick={ next } disabled={ props.selectedCards.length === 0 }>
					SELECT CARD
				</Button>
			</div>
		</DialogFooter>
	</Fragment>
);

const SelectPlayerModalContent = ( { next, back, ...props }: SelectPlayerProps & StepperProps ) => (
	<Fragment>
		<DialogHeader>
			<DialogTitle>Select Player to Ask</DialogTitle>
		</DialogHeader>
		<div>
			<SelectPlayer { ...props }/>
		</div>
		<DialogFooter>
			<div className={ "w-full flex gap-3" }>
				<Button className={ "w-full" } onClick={ back }>
					BACK
				</Button>
				<Button className={ "w-full" } onClick={ next } disabled={ !props.player }>
					SELECT PLAYER
				</Button>
			</div>
		</DialogFooter>
	</Fragment>
);

type ConfirmAskProps = {
	isPending?: boolean;
	selectedPlayer: Player;
	selectedCard: PlayingCard;
	handleSubmit: VoidFunction;
}

const ConfirmAskModalContent = ( props: ConfirmAskProps & StepperProps ) => (
	<Fragment>
		<DialogHeader>
			<DialogTitle>Confirm</DialogTitle>
		</DialogHeader>
		<div>
			<h2>
				Ask { props.selectedPlayer.name } for { props.selectedCard.displayString }
			</h2>
		</div>
		<DialogFooter>
			<div className={ "w-full flex gap-3" }>
				<Button className={ "w-full" } onClick={ props.back }>
					BACK
				</Button>
				<Button className={ "w-full" } onClick={ props.handleSubmit }>
					{ props.isPending ? <Spinner/> : "ASK CARD" }
				</Button>
			</div>
		</DialogFooter>
	</Fragment>
);

export const AskCard = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const hand = useHand();
	const cardSets = useCardSetsInHand();
	const oppositeTeam = useOppositeTeam();
	const cardCounts = useCardCounts();

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ open, setOpen ] = useState( false );

	const openDialog = useCallback( () => {
		setOpen( true );
	}, [] );

	const askableCardSets = useMemo( () => {
		return Array.from( cardSets ).filter( cardSet => {
			const cards = hand.getCardsOfSet( cardSet );
			return cards.length !== 6;
		} );
	}, [ cardSets, hand ] );

	const oppositeTeamMembersWithCards = useMemo( () => {
		return oppositeTeam?.memberIds.map( memberId => players[ memberId ] )
			.filter( member => !!cardCounts[ member.id ] ) ?? [];
	}, [ oppositeTeam, cardCounts, players ] );

	const closeModal = useCallback( () => {
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		stepper.reset();
		setOpen( false );
	}, [] );

	const handleCardSetSelection = useCallback(
		( cardSet?: string ) => setSelectedCardSet( cardSet as CardSet | undefined ),
		[]
	);

	const stepper = useStepper();

	const { isPending, execute } = useServerAction( askCardAction, {
		onFinish: () => closeModal()
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<Button onClick={ openDialog }>ASK CARD</Button>
			<DialogContent>
				{ stepper.when( "SET", () => (
					<SelectCardSetModalContent
						cardSet={ selectedCardSet }
						cardSetOptions={ askableCardSets }
						handleSelection={ handleCardSetSelection }
						next={ stepper.next }
						back={ stepper.prev }
					/>
				) ) }
				{ stepper.when( "CARD", () => (
					<SelectCardModalContent
						cards={ hand.getAskableCardsOfSet( selectedCardSet! ) }
						selectedCards={ !selectedCard ? [] : [ selectedCard ] }
						onSelect={ ( cardId ) => setSelectedCard( cardId ) }
						onDeselect={ () => setSelectedCard( undefined ) }
						next={ stepper.next }
						back={ stepper.prev }
					/>
				) ) }
				{ stepper.when( "PLAYER", () => (
					<SelectPlayerModalContent
						player={ selectedPlayer }
						options={ oppositeTeamMembersWithCards }
						setPlayer={ setSelectedPlayer }
						next={ stepper.next }
						back={ stepper.prev }
					/>
				) ) }
				{ stepper.when( "CONFIRM", () => (
					<ConfirmAskModalContent
						isPending={ isPending }
						selectedPlayer={ players[ selectedPlayer! ] }
						selectedCard={ PlayingCard.fromId( selectedCard! ) }
						handleSubmit={ () => execute( { gameId, from: selectedPlayer!, for: selectedCard! } ) }
						back={ stepper.prev }
					/>
				) ) }
			</DialogContent>
		</Dialog>
	);
};

const { useStepper } = defineStepper(
	{ id: "SET", title: "Select Card Set" },
	{ id: "CARD", title: "Select Card" },
	{ id: "PLAYER", title: "Select Player" },
	{ id: "CONFIRM", title: "Confirm Ask" }
);