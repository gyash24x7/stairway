import type { Player } from "@backend/literature/src/literature.types.ts";
import { CardSet, PlayingCard } from "@common/cards";
import {
	Button,
	ButtonSpinner,
	ButtonText,
	Heading,
	HStack,
	Icon,
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader
} from "@gluestack-ui/themed";
import { X } from "lucide-react-native";
import { Fragment, type PropsWithChildren, useCallback, useMemo, useRef, useState } from "react";
import {
	useAskCardMutation,
	useCardCounts,
	useCardSetsInHand,
	useGameId,
	useHand,
	useOppositeTeam,
	usePlayers
} from "../store";
import { SelectCard, type SelectCardProps } from "./select-card";
import { SelectCardSet, type SelectCardSetProps } from "./select-card-set";
import { SelectPlayer, type SelectPlayerProps } from "./select-player";

type PaneState = "SET" | "CARD" | "PLAYER" | "CONFIRM"
type UpdatePaneStateProp = {
	updatePaneState: ( state: PaneState ) => () => void;
}

const AskCardModalHeader = ( props: PropsWithChildren ) => (
	<ModalHeader>
		<Heading size={ "lg" }>{ props.children }</Heading>
		<ModalCloseButton>
			<Icon as={ X }/>
		</ModalCloseButton>
	</ModalHeader>
);

const SelectCardSetModalContent = ( { updatePaneState, ...props }: SelectCardSetProps & UpdatePaneStateProp ) => (
	<ModalContent>
		<AskCardModalHeader>Select CardSet to Ask</AskCardModalHeader>
		<ModalBody>
			<SelectCardSet { ...props } />
		</ModalBody>
		<ModalFooter>
			<Button flex={ 1 } onPress={ updatePaneState( "CARD" ) } isDisabled={ !props.cardSet }>
				<ButtonText>SELECT CARD SET</ButtonText>
			</Button>
		</ModalFooter>
	</ModalContent>
);

const SelectCardModalContent = ( { updatePaneState, ...props }: SelectCardProps & UpdatePaneStateProp ) => (
	<ModalContent>
		<AskCardModalHeader>Select Card to Ask</AskCardModalHeader>
		<ModalBody>
			<SelectCard { ...props } />
		</ModalBody>
		<ModalFooter>
			<HStack gap={ "$3" } width={ "100%" }>
				<Button flex={ 1 } onPress={ updatePaneState( "SET" ) }>
					<ButtonText>BACK</ButtonText>
				</Button>
				<Button
					flex={ 1 }
					onPress={ updatePaneState( "PLAYER" ) }
					isDisabled={ props.selectedCards.length === 0 }
				>
					<ButtonText>SELECT CARD</ButtonText>
				</Button>
			</HStack>
		</ModalFooter>
	</ModalContent>
);

const SelectPlayerModalContent = ( { updatePaneState, ...props }: SelectPlayerProps & UpdatePaneStateProp ) => (
	<ModalContent>
		<ModalHeader>
			<Heading size={ "lg" }>Select Player to Ask</Heading>
			<ModalCloseButton>
				<Icon as={ X }/>
			</ModalCloseButton>
		</ModalHeader>
		<ModalBody>
			<SelectPlayer { ...props }/>
		</ModalBody>
		<ModalFooter>
			<HStack gap={ "$3" } width={ "100%" }>
				<Button flex={ 1 } onPress={ updatePaneState( "CARD" ) }>
					<ButtonText>BACK</ButtonText>
				</Button>
				<Button flex={ 1 } onPress={ updatePaneState( "CONFIRM" ) } isDisabled={ !props.player }>
					<ButtonText>SELECT PLAYER</ButtonText>
				</Button>
			</HStack>
		</ModalFooter>
	</ModalContent>
);

type ConfirmAskProps = {
	selectedPlayer: Player;
	selectedCard: PlayingCard;
	handleSubmit: VoidFunction;
	isPending: boolean;
}

const ConfirmAskModalContent = ( props: ConfirmAskProps & UpdatePaneStateProp ) => (
	<ModalContent>
		<ModalHeader>
			<Heading size={ "lg" }>Confirm</Heading>
			<ModalCloseButton>
				<Icon as={ X }/>
			</ModalCloseButton>
		</ModalHeader>
		<ModalBody>
			<Heading>
				Ask { props.selectedPlayer.name } for { props.selectedCard.displayString }
			</Heading>
		</ModalBody>
		<ModalFooter>
			<HStack gap={ "$3" } width={ "100%" }>
				<Button flex={ 1 } onPress={ props.updatePaneState( "PLAYER" ) }>
					<ButtonText>BACK</ButtonText>
				</Button>
				<Button flex={ 1 } onPress={ props.handleSubmit }>
					{ props.isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>ASK CARD</ButtonText> }
				</Button>
			</HStack>
		</ModalFooter>
	</ModalContent>
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

	const [ showModal, setShowModal ] = useState( false );
	const [ paneState, setPaneState ] = useState<PaneState>( "SET" );

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

	const openModal = useCallback( () => {
		setPaneState( "SET" );
		setShowModal( true );
	}, [] );

	const closeModal = useCallback( () => {
		setShowModal( false );
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		setPaneState( "SET" );
	}, [] );

	const ref = useRef( null );
	const handleCardSetSelection = useCallback(
		( cardSet?: string ) => setSelectedCardSet( cardSet as CardSet | undefined ),
		[]
	);

	const { mutateAsync, isPending } = useAskCardMutation();
	const handleSubmit = useCallback(
		() => mutateAsync( { for: selectedCard!, from: selectedPlayer!, gameId } )
			.catch( e => alert( e.message ) )
			.finally( closeModal ),
		[ selectedCard, selectedPlayer, gameId ]
	);

	const updatePaneState = ( paneState: PaneState ) => () => setPaneState( paneState );

	return (
		<Fragment>
			<Button flex={ 1 } onPress={ openModal }>
				<ButtonText size={ "sm" }>ASK CARD</ButtonText>
			</Button>
			<Modal isOpen={ showModal } onClose={ closeModal } finalFocusRef={ ref }>
				<ModalBackdrop/>
				{ paneState === "SET" && (
					<SelectCardSetModalContent
						cardSet={ selectedCardSet }
						cardSetOptions={ askableCardSets }
						handleSelection={ handleCardSetSelection }
						updatePaneState={ updatePaneState }
					/>
				) }
				{ paneState === "CARD" && !!selectedCardSet && (
					<SelectCardModalContent
						cards={ hand.getAskableCardsOfSet( selectedCardSet ) }
						selectedCards={ !selectedCard ? [] : [ selectedCard ] }
						onSelect={ ( cardId ) => setSelectedCard( cardId ) }
						onDeselect={ () => setSelectedCard( undefined ) }
						updatePaneState={ updatePaneState }
					/>
				) }
				{ paneState === "PLAYER" && !!selectedCard && !!selectedCardSet && (
					<SelectPlayerModalContent
						player={ selectedPlayer }
						options={ oppositeTeamMembersWithCards }
						setPlayer={ setSelectedPlayer }
						updatePaneState={ updatePaneState }
					/>
				) }
				{ paneState === "CONFIRM" && !!selectedPlayer && !!selectedCard && !!selectedCardSet && (
					<ConfirmAskModalContent
						selectedPlayer={ players[ selectedPlayer! ] }
						selectedCard={ PlayingCard.fromId( selectedCard! ) }
						handleSubmit={ handleSubmit }
						isPending={ isPending }
						updatePaneState={ updatePaneState }
					/>
				) }
			</Modal>
		</Fragment>
	);
};