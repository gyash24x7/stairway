import { CardSet, cardSetMap, getPlayingCardFromId } from "@s2h/cards";
import { Button, Combobox, Flex, Group, Modal, Stack, useCombobox } from "@mantine/core";
import { Fragment, useState } from "react";
import { DisplayCard, useAction } from "@s2h/ui";
import { SelectCardSet } from "./select-card-set";
import { useDisclosure } from "@mantine/hooks";
import { callSet, useGameStore } from "../utils";
import { useAuthStore } from "@auth/ui";

interface SelectCardsProps {
	cardIds: string[];
	options: string[];
	handleSelection: ( value: string ) => void;
}

function SelectCards( { handleSelection, cardIds, options }: SelectCardsProps ) {
	const combobox = useCombobox();

	return (
		<Combobox store={ combobox } onOptionSubmit={ handleSelection }>
			<Combobox.Options>
				<Flex wrap={ "wrap" } gap={ "sm" }>
					{ options.map( cardId => (
						<Combobox.Option
							value={ cardId }
							key={ cardId }
							selected={ cardIds.includes( cardId ) }
							p={ 8 }
						>
							<DisplayCard card={ getPlayingCardFromId( cardId ) }/>
						</Combobox.Option>
					) ) }
				</Flex>
			</Combobox.Options>
		</Combobox>
	);
}

export function CallSet() {
	const authInfo = useAuthStore( state => state.authInfo );
	const players = useGameStore( state => state.gameData!.players );
	const loggedInPlayer = players[ authInfo!.id ];

	const gameId = useGameStore( state => state.gameData!.id );
	const callableCardSets = useGameStore( state => state.playerData!.cardSets );
	const cardCounts = useGameStore( state => state.gameData!.cardCounts );
	const myTeam = useGameStore( state => state.gameData!.teams[ loggedInPlayer.teamId! ] );

	const teamMemberIds = [
		loggedInPlayer.id,
		...myTeam!.members.filter( id => id !== loggedInPlayer.id || !cardCounts[ id ] )
	];

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<string[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string>>( {} );

	const [ opened, { open, close } ] = useDisclosure();
	const [ modalTitle, setModalTitle ] = useState( "Select Card Set to Call" );
	const [ paneState, setPaneState ] = useState( "SET" );

	const { execute, isLoading } = useAction( callSet );

	const handleCardSetSelect = ( value: string ) => {
		const cardSet: CardSet = value as CardSet;
		setSelectedCardSet( cardSet );
		setCardOptions( cardSetMap[ cardSet ].map( c => c.id ) );
	};

	const handleCardSelect = ( playerId: string ) => ( cardId: string ) => {
		setCardMap( currentValue => {
			return { ...currentValue, [ cardId ]: playerId };
		} );
	};

	const handleConfirm = () => execute( { data: cardMap, gameId } )
		.catch( e => alert( e.message ) )
		.then( closeModal );

	const openModalForPlayer = ( index: number ) => async () => {
		const playerId = teamMemberIds[ index ];

		if ( index < teamMemberIds.length ) {
			setPaneState( playerId );
			setModalTitle( `Select Cards with ${ players[ playerId ].name }` );
		} else {
			setPaneState( "CONFIRM" );
			setModalTitle( "Confirm Call" );
		}
	};

	const openSelectCardSet = () => {
		setPaneState( "SET" );
		open();
	};

	const closeModal = () => {
		setPaneState( "SET" );
		setSelectedCardSet( undefined );
		setCardOptions( [] );
		setCardMap( {} );
		close();
	};

	return (
		<Fragment>
			<Modal opened={ opened } onClose={ closeModal } title={ modalTitle } centered size={ "lg" }>
				{ paneState === "SET" && (
					<Stack>
						<SelectCardSet
							handleSelection={ handleCardSetSelect }
							cardSet={ selectedCardSet }
							cardSetOptions={ callableCardSets }
						/>
						<Button onClick={ openModalForPlayer( 0 ) } disabled={ !selectedCardSet }>
							Select Card Locations
						</Button>
					</Stack>
				) }
				{ teamMemberIds.map( ( memberId, index ) => {
					if ( paneState === memberId ) {
						return (
							<Stack key={ memberId }>
								<SelectCards
									cardIds={ Object.keys( cardMap ).filter( id => cardMap[ id ] === memberId ) }
									options={ cardOptions }
									handleSelection={ handleCardSelect( memberId ) }
								/>
								<Group>
									<Button
										onClick={ index <= 0 ? openSelectCardSet : openModalForPlayer( index - 1 ) }>
										Back
									</Button>
									<Button onClick={ openModalForPlayer( index + 1 ) }>
										Next
									</Button>
								</Group>
							</Stack>
						);
					}
					return undefined;
				} ) }
				{ paneState === "CONFIRM" && (
					<Group>
						<Button onClick={ openModalForPlayer( teamMemberIds.length - 1 ) }>Back</Button>
						<Button
							onClick={ handleConfirm }
							loading={ isLoading }
							disabled={ Object.keys( cardMap ).length !== 6 }
						>
							Call Set
						</Button>
					</Group>
				) }
			</Modal>
			<Button color={ "danger" } onClick={ openSelectCardSet }>Call Set</Button>
		</Fragment>
	);
}