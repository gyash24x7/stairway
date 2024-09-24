import { Button, Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@base/components";
import { useCardCounts, useCardSetsInHand, useGameId, useHand, useOppositeTeam, usePlayers } from "@literature/store";
import { CardSet, PlayingCard } from "@stairway/cards";
import { defineStepper } from "@stepperize/react";
import { ReactNode, useCallback, useMemo, useState } from "react";
import { AskCard } from "./game-actions.tsx";
import { SelectCardSet } from "./select-card-set.tsx";
import { SelectCard } from "./select-card.tsx";
import { SelectPlayer } from "./select-player.tsx";

const ActionModal = ( props: { title: string; content?: ReactNode; footer: ReactNode; } ) => (
	<div className={ "mx-auto w-full max-w-lg" }>
		<DrawerHeader>
			<DrawerTitle className={ "text-center" }>{ props.title }</DrawerTitle>
		</DrawerHeader>
		<div className={ "px-4" }>{ props.content }</div>
		<DrawerFooter>{ props.footer }</DrawerFooter>
	</div>
);

const { useStepper } = defineStepper(
	{ id: "SET", title: "Select Card Set" },
	{ id: "CARD", title: "Select Card" },
	{ id: "PLAYER", title: "Select Player" },
	{ id: "CONFIRM", title: "Confirm Ask" }
);

export const AskCardDialog = () => {
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

	const openDrawer = useCallback( () => {
		setOpen( true );
	}, [] );

	const askableCardSets = useMemo( () => {
		return Array.from( cardSets ).filter( cardSet => {
			const cards = hand.getCardsOfSet( cardSet );
			return cards.length !== 6;
		} );
	}, [ cardSets, hand ] );

	console.log( askableCardSets );
	console.log( hand );

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

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>ASK CARD</Button>
			<DrawerContent>
				{ stepper.when( "SET", () => (
					<ActionModal
						title={ "Select CardSet to Ask" }
						content={
							<SelectCardSet
								cardSet={ selectedCardSet }
								cardSetOptions={ askableCardSets }
								handleSelection={ handleCardSetSelection }
							/>
						}
						footer={
							<Button className={ "flex-1" } onClick={ stepper.next } disabled={ !selectedCardSet }>
								SELECT CARD SET
							</Button>
						}
					/>
				) ) }
				{ stepper.when( "CARD", () => (
					<ActionModal
						title={ "Select Card to Ask" }
						content={
							<SelectCard
								cards={ hand.getAskableCardsOfSet( selectedCardSet! ) }
								selectedCards={ !selectedCard ? [] : [ selectedCard ] }
								onSelect={ ( cardId ) => setSelectedCard( cardId ) }
								onDeselect={ () => setSelectedCard( undefined ) }
							/>
						}
						footer={
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ stepper.prev } className={ "flex-1" }>BACK</Button>
								<Button onClick={ stepper.next } disabled={ !selectedCard } className={ "flex-1" }>
									SELECT CARD
								</Button>
							</div>
						}
					/>
				) ) }
				{ stepper.when( "PLAYER", () => (
					<ActionModal
						title={ "Select Player to Ask" }
						content={
							<SelectPlayer
								player={ selectedPlayer }
								options={ oppositeTeamMembersWithCards }
								setPlayer={ setSelectedPlayer }
							/>
						}
						footer={
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ stepper.prev } className={ "flex-1" }>BACK</Button>
								<Button onClick={ stepper.next } disabled={ !selectedPlayer } className={ "flex-1" }>
									SELECT PLAYER
								</Button>
							</div>
						}
					/>
				) ) }
				{ stepper.when( "CONFIRM", () => (
					<ActionModal
						title={ `Ask ${ players[ selectedPlayer! ].name } for ${ PlayingCard.fromId( selectedCard! ).displayString }` }
						footer={
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ stepper.prev } className={ "flex-1" }>BACK</Button>
								<AskCard
									gameId={ gameId }
									from={ selectedPlayer! }
									card={ selectedCard! }
									onSubmit={ closeModal }
								/>
							</div>
						}
					/>
				) ) }
			</DrawerContent>
		</Drawer>
	);
};
