import {
	type CardSet,
	getAskableCardsOfSet,
	getCardDisplayString,
	getCardFromId,
	getCardsOfSet,
	getSetsInHand
} from "@stairway/cards";
import { Button, Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@stairway/components/base";
import { SelectCard } from "@stairway/components/main";
import { useCardCounts, useGameId, useHand, useOppositeTeam, usePlayers } from "@stairway/stores/literature";
import { useCallback, useMemo, useState } from "react";
import { useStep } from "usehooks-ts";
import { AskCard } from "./game-actions.tsx";
import { SelectCardSet } from "./select-card-set.tsx";
import { SelectPlayer } from "./select-player.tsx";

export const AskCardDialog = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const hand = useHand();
	const oppositeTeam = useOppositeTeam();
	const cardCounts = useCardCounts();

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ open, setOpen ] = useState( false );

	const openDrawer = useCallback( () => setOpen( true ), [] );

	const askableCardSets = useMemo( () => {
		return Array.from( getSetsInHand( hand ) ).filter( cardSet => {
			const cards = getCardsOfSet( hand, cardSet );
			return cards.length !== 6;
		} );
	}, [ hand ] );

	const oppositeTeamMembersWithCards = useMemo( () => {
		return oppositeTeam?.memberIds.map( memberId => players[ memberId ] )
			.filter( member => !!cardCounts[ member.id ] ) ?? [];
	}, [ oppositeTeam, cardCounts, players ] );

	const handleCardSetSelection = useCallback(
		( cardSet?: string ) => setSelectedCardSet( cardSet as CardSet | undefined ),
		[]
	);

	const [ currentStep, { reset, goToNextStep, goToPrevStep } ] = useStep( 4 );

	const closeModal = useCallback( () => {
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		reset();
		setOpen( false );
	}, [] );

	const confirmAskDrawerTitle = useMemo( () => {
		if ( selectedPlayer && selectedCard ) {
			return `Ask ${ players[ selectedPlayer ].name } for ${ getCardDisplayString( getCardFromId( selectedCard ) ) }`;
		}

		return "";
	}, [ players, selectedPlayer, selectedCard ] );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>ASK CARD</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>
							{ currentStep === 1 && "Select Card Set to Ask" }
							{ currentStep === 2 && "Select Card to Ask" }
							{ currentStep === 3 && "Select Player to Ask" }
							{ currentStep === 4 && confirmAskDrawerTitle }
						</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						{ currentStep === 1 && (
							<SelectCardSet
								cardSet={ selectedCardSet }
								cardSetOptions={ askableCardSets }
								handleSelection={ handleCardSetSelection }
							/>
						) }
						{ currentStep === 2 && (
							<SelectCard
								cards={ getAskableCardsOfSet( hand, selectedCardSet! ) }
								selectedCards={ !selectedCard ? [] : [ selectedCard ] }
								onSelect={ ( cardId ) => setSelectedCard( cardId ) }
								onDeselect={ () => setSelectedCard( undefined ) }
							/>
						) }
						{ currentStep === 3 && (
							<SelectPlayer
								player={ selectedPlayer }
								options={ oppositeTeamMembersWithCards }
								setPlayer={ setSelectedPlayer }
							/>
						) }
					</div>
					<DrawerFooter>
						{ currentStep === 1 && (
							<Button className={ "flex-1" } onClick={ goToNextStep } disabled={ !selectedCardSet }>
								SELECT CARD SET
							</Button>
						) }
						{ currentStep === 2 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ goToNextStep } disabled={ !selectedCard } className={ "flex-1" }>
									SELECT CARD
								</Button>
							</div>
						) }
						{ currentStep === 3 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<Button onClick={ goToNextStep } disabled={ !selectedPlayer } className={ "flex-1" }>
									SELECT PLAYER
								</Button>
							</div>
						) }
						{ currentStep === 4 && (
							<div className={ "w-full flex gap-3" }>
								<Button onClick={ goToPrevStep } className={ "flex-1" }>BACK</Button>
								<AskCard
									gameId={ gameId }
									from={ selectedPlayer! }
									card={ selectedCard! }
									onSubmit={ closeModal }
								/>
							</div>
						) }
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
};
