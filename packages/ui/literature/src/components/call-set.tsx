import type { Player, PlayerData } from "@backend/literature";
import { CardSet, cardSetMap, PlayingCard } from "@common/cards";
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
	ModalHeader,
	Text,
	VStack
} from "@gluestack-ui/themed";
import { X } from "lucide-react-native";
import { Fragment, type PropsWithChildren, useCallback, useRef, useState } from "react";
import { useCallSetMutation, useCardSetsInHand, useGameId, useMyTeam, usePlayers } from "../store";
import { SelectCard } from "./select-card";
import { SelectCardSet, type SelectCardSetProps } from "./select-card-set";

type PaneState = "SET" | "LOCATIONS" | "CONFIRM"

type UpdatePaneStateProps = {
	updatePaneState: ( state: PaneState ) => () => void;
}

const CallSetModalHeader = ( props: PropsWithChildren ) => (
	<ModalHeader>
		<Heading size={ "lg" }>{ props.children }</Heading>
		<ModalCloseButton>
			<Icon as={ X }/>
		</ModalCloseButton>
	</ModalHeader>
);

const SelectCardSetModalContent = ( props: SelectCardSetProps & UpdatePaneStateProps ) => (
	<ModalContent>
		<CallSetModalHeader>Select CardSet to Call</CallSetModalHeader>
		<ModalBody>
			<SelectCardSet
				cardSetOptions={ props.cardSetOptions }
				handleSelection={ props.handleSelection }
				cardSet={ props.cardSet }
			/>
		</ModalBody>
		<ModalFooter>
			<Button flex={ 1 } onPress={ props.updatePaneState( "LOCATIONS" ) } isDisabled={ !props.cardSet }>
				<ButtonText>SELECT CARD SET</ButtonText>
			</Button>
		</ModalFooter>
	</ModalContent>
);

type SelectCardLocationProps = {
	players: Player[];
	cardMap: Record<string, string>;
	cardOptions: PlayingCard[];
	onCardSelect: ( playerId: string ) => ( cardId: string ) => void;
	onCardDeselect: ( cardId: string ) => void;
}

const SelectCardLocationsModalContent = ( props: SelectCardLocationProps & UpdatePaneStateProps ) => {

	const getCardsForPlayers = useCallback(
		( playerId: string ) => Object.keys( props.cardMap ).filter( cardId => props.cardMap[ cardId ] === playerId ),
		[ props.cardMap ]
	);

	return (
		<ModalContent>
			<CallSetModalHeader>Select Card Locations</CallSetModalHeader>
			<ModalBody>
				<VStack gap={ "$3" }>
					{ props.players.map( player => (
						<Fragment key={ player.id }>
							<Heading size={ "lg" }>Cards With { player.name }</Heading>
							<SelectCard
								cards={ props.cardOptions }
								selectedCards={ getCardsForPlayers( player.id ) }
								onSelect={ props.onCardSelect( player.id ) }
								onDeselect={ props.onCardDeselect }
							/>
						</Fragment>
					) ) }
				</VStack>
			</ModalBody>
			<ModalFooter>
				<HStack gap={ "$3" }>
					<Button flex={ 1 } onPress={ props.updatePaneState( "SET" ) }>
						<ButtonText>BACK</ButtonText>
					</Button>
					<Button flex={ 1 } onPress={ props.updatePaneState( "CONFIRM" ) }>
						<ButtonText>NEXT</ButtonText>
					</Button>
				</HStack>
			</ModalFooter>
		</ModalContent>
	);
};

type ConfirmCallProps = {
	cardSet: CardSet;
	cardMap: Record<string, string>
	players: PlayerData;
	isPending: boolean;
	onConfirmCall: () => void
}

const ConfirmCallModalContent = ( { cardMap, players, ...props }: ConfirmCallProps & UpdatePaneStateProps ) => (
	<ModalContent>
		<CallSetModalHeader>Confirm Call for { props.cardSet }</CallSetModalHeader>
		<ModalBody>
			<VStack gap={ "$3" }>
				{ Object.keys( cardMap ).map( cardId => (
					<Text key={ cardId }>
						{ PlayingCard.fromId( cardId ).displayString } is with { players[ cardMap[ cardId ] ].name }
					</Text>
				) ) }
			</VStack>
		</ModalBody>
		<ModalFooter>
			<HStack w={ "100%" } gap={ "$3" }>
				<Button flex={ 1 } onPress={ props.updatePaneState( "LOCATIONS" ) }>
					<ButtonText>BACK</ButtonText>
				</Button>
				<Button flex={ 1 } onPress={ props.onConfirmCall }>
					{ props.isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>CONFIRM CALL</ButtonText> }
				</Button>
			</HStack>
		</ModalFooter>
	</ModalContent>
);

export const CallSet = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const cardSets = useCardSetsInHand();
	const team = useMyTeam();

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<string[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string>>( {} );

	const [ showModal, setShowModal ] = useState( false );
	const [ paneState, setPaneState ] = useState<PaneState>( "SET" );

	const openModal = useCallback( () => {
		setPaneState( "SET" );
		setShowModal( true );
	}, [] );

	const closeModal = useCallback( () => {
		setPaneState( "SET" );
		setSelectedCardSet( undefined );
		setCardOptions( [] );
		setCardMap( {} );
		setShowModal( false );
	}, [] );

	const ref = useRef( null );

	const { mutateAsync, isPending } = useCallSetMutation();

	const handleCardSetSelect = useCallback( ( value?: string ) => {
		if ( !value ) {
			setSelectedCardSet( undefined );
		} else {
			const cardSet: CardSet = value as CardSet;
			setSelectedCardSet( cardSet );
			setCardOptions( cardSetMap[ cardSet ].map( PlayingCard.from ).map( c => c.id ) );
		}
	}, [] );

	const handleSubmit = useCallback(
		() => mutateAsync( { data: cardMap, gameId } )
			.catch( e => alert( e.message ) )
			.then( closeModal ),
		[ cardMap, gameId ]
	);

	const handleCardSelectForPlayer = ( playerId: string ) => ( cardId: string ) => {
		setCardMap( data => ( { ...data, [ cardId ]: playerId } ) );
	};

	const handleCardDeSelectForPlayer = ( cardId: string ) => {
		setCardMap( data => {
			delete data[ cardId ];
			return { ...data };
		} );
	};

	const updatePaneState = ( paneState: PaneState ) => () => setPaneState( paneState );

	return (
		<Fragment>
			<Button flex={ 1 } onPress={ openModal }>
				<ButtonText size={ "sm" }>CALL SET</ButtonText>
			</Button>
			<Modal isOpen={ showModal } onClose={ closeModal } finalFocusRef={ ref } size={ "lg" }>
				<ModalBackdrop/>
				{ paneState === "SET" && (
					<SelectCardSetModalContent
						cardSet={ selectedCardSet }
						handleSelection={ handleCardSetSelect }
						cardSetOptions={ Array.from( cardSets ) }
						updatePaneState={ updatePaneState }
					/>
				) }
				{ paneState === "LOCATIONS" && (
					<SelectCardLocationsModalContent
						players={ team!.memberIds.map( playerId => players[ playerId ] ) }
						cardMap={ cardMap }
						cardOptions={ cardOptions.map( PlayingCard.fromId ) }
						onCardSelect={ handleCardSelectForPlayer }
						onCardDeselect={ handleCardDeSelectForPlayer }
						updatePaneState={ updatePaneState }
					/>
				) }
				{ paneState === "CONFIRM" && (
					<ConfirmCallModalContent
						cardSet={ selectedCardSet! }
						cardMap={ cardMap }
						players={ players }
						isPending={ isPending }
						onConfirmCall={ handleSubmit }
						updatePaneState={ updatePaneState }
					/>
				) }
			</Modal>
		</Fragment>
	);
};