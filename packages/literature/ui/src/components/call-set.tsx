import { CardSet, cardSetMap, PlayingCard } from "@s2h/cards";
import type { CallSetInput } from "@literature/data";
import { Button, Combobox, useCombobox } from "@mantine/core";
import { useState } from "react";
import {
	useCurrentGame,
	useCurrentGameCardCounts,
	useCurrentGameHandData,
	useCurrentGameTeams,
	useCurrentPlayer
} from "../utils";
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
						<DisplayCard card={ PlayingCard.fromId( cardId ) }/>
					</Combobox.Option>
				) ) }
			</Combobox.Options>
		</Combobox>
	);
}

export function CallSet() {
	const { id: gameId, players } = useCurrentGame();
	const { myTeam } = useCurrentGameTeams();
	const loggedInPlayer = useCurrentPlayer();
	const { hand, callableCardSets } = useCurrentGameHandData();
	const cardCounts = useCurrentGameCardCounts();

	const mapDefaultValue: Record<string, string[]> = {};
	myTeam?.members.forEach( playerId => mapDefaultValue[ playerId ] = [] );

	const teamMemberIds = [
		loggedInPlayer.id,
		...myTeam!.members.filter( id => id !== loggedInPlayer.id || !cardCounts[ id ] )
	];
	const [ currentIndex, setCurrentIndex ] = useState( 0 );

	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<string[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, string[]>>( mapDefaultValue );

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
		setCardOptions( cardSetMap[ cardSet ].filter( hand!.contains ).map( c => c.cardId ) );
		const newCardMap = { ...cardMap };
		newCardMap[ loggedInPlayer!.id ] = hand!.getCardsOfSet( cardSet ).map( c => c.cardId );
		setCardMap( newCardMap );
	};

	const handleCardSelect = ( playerId: string ) => ( cardId: string ) => {
		let cardsForPlayer = [ ...cardMap[ playerId ] ];
		cardsForPlayer = cardsForPlayer.includes( cardId )
			? cardsForPlayer.filter( c => c !== cardId )
			: [ ...cardsForPlayer, cardId ];

		setCardMap( current => {
			return { ...current, [ playerId ]: cardsForPlayer };
		} );
	};

	const handleConfirm = async () => {
		const finalCardMap: Record<string, PlayingCard[]> = {};
		Object.keys( cardMap ).forEach( playerId => {
			finalCardMap[ playerId ] = cardMap[ playerId ].map( PlayingCard.fromId );
		} );

		const input: CallSetInput = { data: finalCardMap };
		await mutateAsync( input );
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
				cardIds={ cardMap[ playerId ] }
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
		setCardMap( mapDefaultValue );
	};

	return <Button color={ "info" } onClick={ openModal }>Call Set</Button>;
}