import { CardSet, cardSetMap, PlayingCard } from "@s2h/cards";
import type { AskCardInput } from "@literature/data";
import { Button, Combobox, useCombobox } from "@mantine/core";
import { Dispatch, SetStateAction, useState } from "react";
import { useCurrentGame, useCurrentGameHandData, useCurrentGameTeams } from "../utils";
import { PlayerCard } from "./player-card";
import { useAskCardMutation } from "@literature/client";
import { DisplayCard } from "@s2h/ui";
import { modals } from "@mantine/modals";
import { SelectCardSet } from "./select-card-set";

interface SelectCardProps {
	cardSet: CardSet;
	card?: PlayingCard;
	setCard: Dispatch<SetStateAction<PlayingCard | undefined>>;
}

function SelectCard( { cardSet, setCard, card }: SelectCardProps ) {
	const { hand } = useCurrentGameHandData();
	const combobox = useCombobox();

	const handleSelection = ( cardId: string ) => setCard( PlayingCard.fromId( cardId ) );

	return (
		<Combobox store={ combobox } onOptionSubmit={ handleSelection }>
			<Combobox.Options>
				{ cardSetMap[ cardSet ].filter( c => hand?.contains( c ) ).map( c => (
					<Combobox.Option value={ c.cardId } key={ c.cardId } selected={ c.cardId === card?.cardId } p={ 8 }>
						<DisplayCard card={ c }/>
					</Combobox.Option>
				) ) }
			</Combobox.Options>
		</Combobox>
	);
}

interface SelectPlayerProps {
	player?: string;
	setPlayer: Dispatch<SetStateAction<string | undefined>>;
}

function SelectPlayer( { setPlayer, player }: SelectPlayerProps ) {
	const { players } = useCurrentGame();
	const { oppositeTeam } = useCurrentGameTeams();
	const combobox = useCombobox();

	return (
		<Combobox store={ combobox } onOptionSubmit={ setPlayer }>
			<Combobox.Options>
				{ oppositeTeam?.members.map( memberId => (
					<Combobox.Option value={ memberId } key={ memberId } selected={ player === memberId } p={ 8 }>
						<PlayerCard player={ players[ memberId ] }/>
					</Combobox.Option>
				) ) }
			</Combobox.Options>
		</Combobox>
	);
}

export function AskCard() {
	const { id } = useCurrentGame();
	const { askableCardSets } = useCurrentGameHandData();
	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<PlayingCard>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();

	const closeModal = () => {
		modals.closeAll();
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
	};

	const { mutateAsync, isLoading } = useAskCardMutation( id, {
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

	const openSelectPlayerModal = () => modals.openConfirmModal( {
		title: "Select Player to Ask From",
		centered: true,
		labels: { confirm: "Ask Card", cancel: "Back" },
		children: <SelectPlayer player={ selectedPlayer } setPlayer={ setSelectedPlayer }/>,
		onConfirm: () => handleConfirm(),
		confirmProps: { loading: isLoading },
		closeOnConfirm: true
	} );

	const openSelectCardModal = () => modals.openConfirmModal( {
		title: "Select Card to Ask",
		centered: true,
		closeOnConfirm: false,
		labels: { confirm: "Select Player", cancel: "Back" },
		children: <SelectCard cardSet={ selectedCardSet! } setCard={ setSelectedCard } card={ selectedCard }/>,
		onConfirm: openSelectPlayerModal
	} );

	const openModal = () => modals.openConfirmModal( {
		title: "Select Card Set to Ask",
		centered: true,
		closeOnConfirm: false,
		labels: { confirm: "Select Card", cancel: "Close" },
		children: (
			<SelectCardSet
				cardSet={ selectedCardSet }
				handleSelection={ handleCardSetSelection }
				cardSetOptions={ askableCardSets }
			/>
		),
		onConfirm: openSelectCardModal
	} );

	return <Button color={ "alt" } onClick={ openModal }>Ask Card</Button>;
}