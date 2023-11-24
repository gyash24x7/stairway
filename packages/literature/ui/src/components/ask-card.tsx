import { CardSet, getAskableCardsOfSet, getCardsOfSet, getPlayingCardFromId } from "@common/cards";
import { DisplayCard } from "@common/ui";
import {
	useAskCardAction,
	useCardCounts,
	useCardSetsInHand,
	useGameId,
	useHand,
	useOppositeTeam,
	usePlayers
} from "@literature/store";
import { Button, Combobox, Flex, Group, Modal, Stack, Title, useCombobox } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Dispatch, Fragment, SetStateAction, useCallback, useMemo, useState } from "react";
import { SelectCardSet } from "./select-card-set";
import { SelectPlayer } from "./select-player";

interface SelectCardProps {
	set: CardSet;
	card?: string;
	setCard: Dispatch<SetStateAction<string | undefined>>;
}

function SelectCard( { set, setCard, card }: SelectCardProps ) {
	const hand = useHand();
	const combobox = useCombobox();

	return (
		<Combobox store={ combobox } onOptionSubmit={ setCard }>
			<Combobox.Options>
				<Flex wrap={ "wrap" } gap={ "sm" }>
					{ getAskableCardsOfSet( hand ?? [], set ).map( c => (
						<Combobox.Option value={ c.id } key={ c.id } selected={ c.id === card } p={ 8 }>
							<DisplayCard card={ c }/>
						</Combobox.Option>
					) ) }
				</Flex>
			</Combobox.Options>
		</Combobox>
	);
}

export function AskCard() {
	const gameId = useGameId();
	const players = usePlayers();
	const hand = useHand();
	const cardSets = useCardSetsInHand();
	const oppositeTeam = useOppositeTeam();
	const cardCounts = useCardCounts();

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ opened, { open, close } ] = useDisclosure();
	const [ paneState, setPaneState ] = useState<"SET" | "CARD" | "PLAYER" | "CONFIRM">();

	const askableCardSets = useMemo( () => {
		return cardSets.filter( cardSet => {
			const cards = getCardsOfSet( hand, cardSet );
			return cards.length !== 6;
		} );
	}, [ cardSets, hand ] );

	const oppositeTeamMembersWithCards = useMemo( () => {
		return oppositeTeam?.members.map( memberId => players[ memberId ] )
			.filter( member => !!cardCounts[ member.id ] ) ?? [];
	}, [ oppositeTeam, cardCounts, players ] );

	const openModal = useCallback( () => {
		setPaneState( "SET" );
		open();
	}, [] );

	const closeModal = useCallback( () => {
		close();
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		setPaneState( "SET" );
	}, [] );

	const { execute, isLoading } = useAskCardAction();

	const handleCardSetSelection = useCallback( ( cardSet: string ) => setSelectedCardSet( cardSet as CardSet ), [] );

	const handleConfirm = useCallback(
		() => execute( { askedFor: selectedCard!, askedFrom: selectedPlayer!, gameId } )
			.catch( e => alert( e.message ) )
			.finally( closeModal ),
		[ selectedCard, selectedPlayer, gameId ]
	);

	const openConfirmModal = () => setPaneState( "CONFIRM" );

	const openSelectPlayerModal = () => setPaneState( "PLAYER" );

	const openSelectCardModal = () => setPaneState( "CARD" );

	return (
		<Fragment>
			<Button color={ "warning" } onClick={ openModal } fw={ 700 }>ASK CARD</Button>
			<Modal
				opened={ opened }
				onClose={ closeModal }
				title={ <Title order={ 2 }>Ask Card</Title> }
				size={ "lg" }
				centered
			>
				{ paneState === "SET" && (
					<Stack>
						<SelectCardSet
							cardSet={ selectedCardSet }
							handleSelection={ handleCardSetSelection }
							cardSetOptions={ askableCardSets }
						/>
						<Button onClick={ openSelectCardModal } disabled={ !selectedCardSet } fw={ 700 }>
							SELECT CARD
						</Button>
					</Stack>
				) }
				{ paneState === "CARD" && (
					<Stack>
						<SelectCard
							set={ selectedCardSet! }
							setCard={ setSelectedCard }
							card={ selectedCard }
						/>
						<Group>
							<Button onClick={ openModal } fw={ 700 }>BACK</Button>
							<Button onClick={ openSelectPlayerModal } disabled={ !selectedCard } fw={ 700 }>
								SELECT PLAYER
							</Button>
						</Group>
					</Stack>
				) }
				{ paneState === "PLAYER" && (
					<Stack>
						<SelectPlayer
							player={ selectedPlayer }
							setPlayer={ setSelectedPlayer }
							options={ oppositeTeamMembersWithCards }
						/>
						<Group>
							<Button onClick={ openSelectCardModal } fw={ 700 }>Back</Button>
							<Button onClick={ openConfirmModal } disabled={ !selectedPlayer } fw={ 700 }>
								CONFIRM
							</Button>
						</Group>
					</Stack>
				) }
				{ paneState === "CONFIRM" && (
					<Stack>
						<Title>
							Ask { players[ selectedPlayer! ].name } for { getPlayingCardFromId( selectedCard! ).displayString }
						</Title>
						<Group>
							<Button onClick={ openSelectPlayerModal } fw={ 700 }>BACK</Button>
							<Button onClick={ handleConfirm } loading={ isLoading } fw={ 700 }>
								ASK CARD
							</Button>
						</Group>
					</Stack>
				) }
			</Modal>
		</Fragment>
	);
}