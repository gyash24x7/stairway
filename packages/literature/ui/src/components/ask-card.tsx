import { Button, Combobox, Flex, Group, Modal, Stack, Title, useCombobox } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CardSet, getAskableCardsOfSet, getPlayingCardFromId } from "@s2h/cards";
import { DisplayCard } from "@s2h/ui";
import { Dispatch, Fragment, SetStateAction, useCallback, useState } from "react";
import { useAskCardAction, useGameData, usePlayerData } from "../utils";
import { SelectCardSet } from "./select-card-set";
import { SelectPlayer } from "./select-player";

interface SelectCardProps {
	set: CardSet;
	card?: string;
	setCard: Dispatch<SetStateAction<string | undefined>>;
}

function SelectCard( { set, setCard, card }: SelectCardProps ) {
	const { hand } = usePlayerData()!;
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
	const { id: gameId, players, cardCounts, teams } = useGameData()!;
	const { cardSets, oppositeTeamId } = usePlayerData()!;

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ opened, { open, close } ] = useDisclosure();
	const [ paneState, setPaneState ] = useState<"SET" | "CARD" | "PLAYER" | "CONFIRM">();

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
			<Button color={ "warning" } onClick={ openModal }>Ask Card</Button>
			<Modal opened={ opened } onClose={ closeModal } title={ "Ask Card" } size={ "lg" } centered>
				{ paneState === "SET" && (
					<Stack>
						<SelectCardSet
							cardSet={ selectedCardSet }
							handleSelection={ handleCardSetSelection }
							cardSetOptions={ cardSets }
						/>
						<Button onClick={ openSelectCardModal } disabled={ !selectedCardSet }>Select Card</Button>
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
							<Button onClick={ openModal }>Back</Button>
							<Button onClick={ openSelectPlayerModal } disabled={ !selectedCard }>Select Player</Button>
						</Group>
					</Stack>
				) }
				{ paneState === "PLAYER" && (
					<Stack>
						<SelectPlayer
							player={ selectedPlayer }
							setPlayer={ setSelectedPlayer }
							options={ teams[ oppositeTeamId! ]?.members.map( memberId => players[ memberId ] )
								.filter( member => !!cardCounts[ member.id ] ) ?? [] }
						/>
						<Group>
							<Button onClick={ openSelectCardModal }>Back</Button>
							<Button onClick={ openConfirmModal } disabled={ !selectedPlayer }>Confirm</Button>
						</Group>
					</Stack>
				) }
				{ paneState === "CONFIRM" && (
					<Stack>
						<Title>
							Ask { players[ selectedPlayer! ].name } for { getPlayingCardFromId( selectedCard! ).displayString }
						</Title>
						<Group>
							<Button onClick={ openSelectPlayerModal }>Back</Button>
							<Button onClick={ handleConfirm } loading={ isLoading }>Ask Card</Button>
						</Group>
					</Stack>
				) }
			</Modal>
		</Fragment>
	);
}