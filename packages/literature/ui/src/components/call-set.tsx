import { Button, Combobox, Flex, Group, Modal, Stack, Title, useCombobox } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CardSet, cardSetMap, getPlayingCardFromId } from "@s2h/cards";
import { DisplayCard } from "@s2h/ui";
import { IconArrowBigRight } from "@tabler/icons-react";
import { Fragment, useCallback, useState } from "react";
import { useCallSetAction, useCardSetsInHand, useGameId, useMyTeam, usePlayers } from "../store";
import { DisplayPlayerVertical } from "./display-player";
import { SelectCardSet } from "./select-card-set";

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
	const gameId = useGameId();
	const team = useMyTeam();
	const players = usePlayers();
	const cardSets = useCardSetsInHand();

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<string[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string>>( {} );

	const [ opened, { open, close } ] = useDisclosure();
	const [ modalTitle, setModalTitle ] = useState( "Select Card Set to Call" );
	const [ paneState, setPaneState ] = useState( "SET" );

	const { execute, isLoading } = useCallSetAction();

	const handleCardSetSelect = useCallback( ( value: string ) => {
		const cardSet: CardSet = value as CardSet;
		setSelectedCardSet( cardSet );
		setCardOptions( cardSetMap[ cardSet ].map( c => c.id ) );
	}, [] );


	const handleCardSelect = useCallback( ( playerId: string ) => ( cardId: string ) => {
		setCardMap( currentValue => {
			return { ...currentValue, [ cardId ]: playerId };
		} );
	}, [] );

	const handleConfirm = useCallback(
		() => execute( { data: cardMap, gameId } )
			.catch( e => alert( e.message ) )
			.then( closeModal ),
		[ cardMap, gameId ]
	);

	const openModalForPlayer = useCallback( ( index: number ) => async () => {
		const teamMemberIds = team!.members;
		const playerId = teamMemberIds[ index ];

		if ( index < teamMemberIds.length ) {
			setPaneState( playerId );
			setModalTitle( `Select Cards with ${ players[ playerId ].name }` );
		} else {
			setPaneState( "CONFIRM" );
			setModalTitle( "Confirm Call" );
		}
	}, [ team ] );

	const openSelectCardSet = useCallback( () => {
		setPaneState( "SET" );
		open();
	}, [] );

	const closeModal = useCallback( () => {
		setPaneState( "SET" );
		setSelectedCardSet( undefined );
		setCardOptions( [] );
		setCardMap( {} );
		close();
	}, [] );

	return (
		<Fragment>
			<Modal
				opened={ opened }
				onClose={ closeModal }
				title={ <Title order={ 2 }>{ modalTitle }</Title> }
				centered
				size={ "lg" }
			>
				{ paneState === "SET" && (
					<Stack>
						<SelectCardSet
							handleSelection={ handleCardSetSelect }
							cardSet={ selectedCardSet }
							cardSetOptions={ cardSets }
						/>
						<Button onClick={ openModalForPlayer( 0 ) } disabled={ !selectedCardSet } fw={ 700 }>
							SELECT CARD LOCATIONS
						</Button>
					</Stack>
				) }
				{ team?.members.map( ( memberId, index ) => {
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
										onClick={ index <= 0 ? openSelectCardSet : openModalForPlayer( index - 1 ) }
										fw={ 700 }
									>
										BACK
									</Button>
									<Button onClick={ openModalForPlayer( index + 1 ) } fw={ 700 }>
										NEXT
									</Button>
								</Group>
							</Stack>
						);
					}
					return undefined;
				} ) }
				{ paneState === "CONFIRM" && (
					<Stack>
						<Flex gap={ 20 } wrap={ "wrap" }>
							{ Object.keys( cardMap ).map( cardId => (
								<Group key={ cardId }>
									<DisplayCard card={ getPlayingCardFromId( cardId ) } orientation={ "horizontal" }/>
									<IconArrowBigRight size={ 24 }/>
									<DisplayPlayerVertical player={ players[ cardMap[ cardId ] ] }/>
								</Group>
							) ) }
						</Flex>
						<Group>
							<Button
								onClick={ openModalForPlayer( team?.members.length ?? 1 - 1 ) }
								fw={ 700 }
							>
								BACK
							</Button>
							<Button
								onClick={ handleConfirm }
								loading={ isLoading }
								disabled={ Object.keys( cardMap ).length !== 6 }
								fw={ 700 }
							>
								CALL SET
							</Button>
						</Group>
					</Stack>
				) }
			</Modal>
			<Button color={ "danger" } onClick={ openSelectCardSet } fw={ 700 }>CALL SET</Button>
		</Fragment>
	);
}