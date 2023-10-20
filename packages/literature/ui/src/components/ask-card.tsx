import { CardSet, getAskableCardsOfSet, getPlayingCardFromId } from "@s2h/cards";
import type { AskCardInput } from "@literature/data";
import { Button, Combobox, Flex, Group, Modal, Stack, Title, useCombobox } from "@mantine/core";
import { Dispatch, Fragment, SetStateAction, useState } from "react";
import { useCurrentGame, useCurrentGameHandData } from "../utils";
import { useAskCardMutation } from "@literature/client";
import { DisplayCard } from "@s2h/ui";
import { SelectCardSet } from "./select-card-set";
import { useDisclosure } from "@mantine/hooks";
import { SelectPlayer } from "./select-player";

interface SelectCardProps {
	set: CardSet;
	card?: string;
	setCard: Dispatch<SetStateAction<string | undefined>>;
}

function SelectCard( { set, setCard, card }: SelectCardProps ) {
	const { hand } = useCurrentGameHandData();
	const combobox = useCombobox();

	return (
		<Combobox store={ combobox } onOptionSubmit={ setCard }>
			<Combobox.Options>
				<Flex wrap={ "wrap" } gap={ "sm" }>
					{ getAskableCardsOfSet( hand, set ).map( c => (
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
	const { id, players, oppositeTeam, cardCounts } = useCurrentGame();
	const { askableCardSets } = useCurrentGameHandData();
	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ opened, { open, close } ] = useDisclosure();
	const [ paneState, setPaneState ] = useState<"SET" | "CARD" | "PLAYER" | "CONFIRM">();

	const openModal = () => {
		setPaneState( "SET" );
		open();
	};

	const closeModal = () => {
		close();
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		setPaneState( "SET" );
	};

	const { mutateAsync, isPending } = useAskCardMutation( id, {
		onSuccess: closeModal,
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const handleCardSetSelection = ( cardSet: string ) => setSelectedCardSet( cardSet as CardSet );

	const handleConfirm = async () => {
		const input: AskCardInput = { askedFor: selectedCard!, askedFrom: selectedPlayer! };
		await mutateAsync( input );
	};

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
							cardSetOptions={ askableCardSets }
						/>
						<Button onClick={ openSelectCardModal }>Select Card</Button>
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
							<Button onClick={ openSelectPlayerModal }>Select Player</Button>
						</Group>
					</Stack>
				) }
				{ paneState === "PLAYER" && (
					<Stack>
						<SelectPlayer
							player={ selectedPlayer }
							setPlayer={ setSelectedPlayer }
							options={ oppositeTeam?.members.map( memberId => players[ memberId ] )
								.filter( member => !!cardCounts[ member.id ] ) ?? [] }
						/>
						<Group>
							<Button onClick={ openSelectCardModal }>Back</Button>
							<Button onClick={ openConfirmModal }>Confirm</Button>
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
							<Button onClick={ handleConfirm } loading={ isPending }>Ask Card</Button>
						</Group>
					</Stack>
				) }
			</Modal>
		</Fragment>
	);
}