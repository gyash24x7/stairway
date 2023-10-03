import { CardSet, cardSetMap, getCardsOfSet, getPlayingCardFromId } from "@s2h/cards";
import { Button, Combobox, useCombobox } from "@mantine/core";
import { useState } from "react";
import { useCurrentGame, useCurrentGameCardCounts, useCurrentGameHandData, useCurrentPlayer } from "../utils";
import { useCallSetMutation } from "@literature/client";
import { DisplayCard } from "@s2h/ui";
import { modals } from "@mantine/modals";
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
				{ options.map( cardId => (
					<Combobox.Option value={ cardId } key={ cardId } selected={ cardIds.includes( cardId ) } p={ 8 }>
						<DisplayCard card={ getPlayingCardFromId( cardId ) }/>
					</Combobox.Option>
				) ) }
			</Combobox.Options>
		</Combobox>
	);
}

export function CallSet() {
	const { id: gameId, players, myTeam } = useCurrentGame();
	const loggedInPlayer = useCurrentPlayer();
	const { hand, callableCardSets } = useCurrentGameHandData();
	const cardCounts = useCurrentGameCardCounts();

	const teamMemberIds = [
		loggedInPlayer.id,
		...myTeam!.members.filter( id => id !== loggedInPlayer.id || !cardCounts[ id ] )
	];
	const [ currentIndex, setCurrentIndex ] = useState( 0 );

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<string[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string>>( {} );

	const { mutateAsync, isLoading } = useCallSetMutation( gameId, {
		onSuccess() {
			closeModal();
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const handleCardSetSelect = ( value: string ) => {
		const cardSet: CardSet = value as CardSet;
		setSelectedCardSet( cardSet );
		setCardOptions( cardSetMap[ cardSet ].map( c => c.id )
			.filter( cardId => hand.map( c => c.id ).includes( cardId ) ) );
		setCardMap( currentValue => {
			getCardsOfSet( hand, cardSet ).forEach( card => {
				currentValue[ card.id ] = loggedInPlayer.id;
			} );
			return currentValue;
		} );
	};

	const handleCardSelect = ( playerId: string ) => ( cardId: string ) => {
		setCardMap( currentValue => {
			return { ...currentValue, [ cardId ]: playerId };
		} );
	};

	const handleConfirm = async () => {
		await mutateAsync( { data: cardMap } );
	};

	const openModalForPlayer = ( playerId: string ) => () => modals.openConfirmModal( {
		title: `Select Cards with ${ players[ playerId ].name }`,
		centered: true,
		closeOnConfirm: currentIndex >= teamMemberIds.length,
		labels: {
			confirm: currentIndex < teamMemberIds.length ? "Next" : "Call Set",
			cancel: "Back"
		},
		confirmProps: { loading: isLoading },
		children: (
			<SelectCards
				cardIds={ Object.keys( cardMap ).filter( cardId => cardMap[ cardId ] === playerId ) }
				options={ cardOptions }
				handleSelection={ handleCardSelect( playerId ) }
			/>
		),
		async onConfirm() {
			if ( currentIndex < teamMemberIds.length ) {
				openModalForPlayer( teamMemberIds[ currentIndex ] );
				setCurrentIndex( currentIndex + 1 );
			} else {
				await handleConfirm();
			}
		}
	} );

	const openModal = () => modals.openConfirmModal( {
		title: "Select Card Set to Call",
		centered: true,
		closeOnConfirm: false,
		labels: { confirm: "Next", cancel: "Close" },
		children: (
			<SelectCardSet
				handleSelection={ handleCardSetSelect }
				cardSet={ selectedCardSet }
				cardSetOptions={ callableCardSets }
			/>
		),
		onConfirm() {
			openModalForPlayer( teamMemberIds[ currentIndex ] );
			setCurrentIndex( currentIndex + 1 );
		}
	} );

	const closeModal = () => {
		modals.closeAll();
		setCardOptions( [] );
		setCardMap( {} );
	};

	return <Button color={ "info" } onClick={ openModal }>Call Set</Button>;
}