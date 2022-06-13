import { Fragment, useState } from "react";
import { trpc } from "../utils/trpc";
import { Button, Flex, HStack, Modal, ModalTitle, MultiSelect, SelectOption, SingleSelect, Stepper } from "@s2h/ui";
import { useGame } from "../utils/game-context";
import { cardSetSrcMap, DisplayCard } from "./display-card";
import type { CallSetInput } from "@s2h/literature/dtos";
import { callSetInputStruct } from "@s2h/literature/dtos";
import { sentenceCase } from "change-case";
import type { CardSet, PlayingCard } from "@s2h/cards";
import { CardHand, cardSetMap } from "@s2h/cards";

export function CallSet() {
	const { myTeam, loggedInPlayer, id: gameId, callableCardSets } = useGame();

	const mapDefaultValue: Record<string, PlayingCard[]> = {};
	myTeam?.members.forEach( player => mapDefaultValue[ player.id ] = [] );

	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ cardOptions, setCardOptions ] = useState<PlayingCard[]>( [] );
	const [ cardMap, setCardMap ] = useState<Record<string, PlayingCard[]>>( mapDefaultValue );


	const { mutateAsync, isLoading } = trpc.useMutation( "call-set", {
		onSuccess() {
			closeModal();
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const handleCardSetSelect = ( cardSet: CardSet ) => {
		setSelectedCardSet( cardSet );
		setCardOptions( cardSetMap[ cardSet ].filter( card => !loggedInPlayer?.hand.contains( card ) ) );
		const newCardMap = { ...cardMap };
		newCardMap[ loggedInPlayer!.id ] = loggedInPlayer!.hand.getCardsOfSet( cardSet );
		setCardMap( newCardMap );
	};

	const handleCardSelect = ( playerId: string ) => ( cards: SelectOption<PlayingCard>[] ) => {
		const newCardMap = { ...cardMap };
		newCardMap[ playerId ] = cards.map( card => card.value );
		setCardMap( newCardMap );
	};

	const handleConfirm = async () => {
		const finalCardMap: Record<string, PlayingCard[]> = {};
		Object.keys( cardMap ).forEach( playerId => {
			finalCardMap[ playerId ] = cardMap[ playerId ];
		} );

		const input: CallSetInput = { gameId, data: finalCardMap };
		const [ error ] = callSetInputStruct.validate( input );

		if ( !error ) {
			console.log( input );
			await mutateAsync( input );
		} else {
			console.error( error );
		}
	};

	const renderCardSetOption = ( cardSet: CardSet ) => {
		const colorClass = cardSet.includes( "Spades" ) || cardSet.includes( "Clubs" )
			? "text-dark-700"
			: "text-danger";

		return (
			<HStack spacing = { "xs" }>
				<h2 className = { `font-fjalla text-4xl ${ colorClass }` }>{ cardSet.split( " " )[ 0 ] }</h2>
				<img
					src = { cardSetSrcMap[ cardSet ] }
					alt = { cardSet }
					className = { "w-8 h-8" }
				/>
			</HStack>
		);
	};

	const renderCardOption = ( { value }: SelectOption<PlayingCard> ) => <DisplayCard card = { value }/>;

	const openModal = () => setIsModalOpen( true );

	const closeModal = () => {
		setSelectedCardSet( undefined );
		setCardOptions( [] );
		setCardMap( mapDefaultValue );
		setIsModalOpen( false );
	};

	return (
		<Fragment>
			<Flex justify = { "center" }>
				<Button buttonText = { "Call Set" } appearance = { "info" } onClick = { openModal }/>
			</Flex>
			<Modal isOpen = { isModalOpen } onClose = { closeModal }>
				<Stepper
					steps = { [
						{
							name: "selectCardSet",
							content: (
								<Fragment>
									<ModalTitle title = { "Select Card Set to Call" }/>
									<SingleSelect
										value = { selectedCardSet }
										onChange = { handleCardSetSelect }
										options = { callableCardSets }
										renderOption = { renderCardSetOption }
									/>
								</Fragment>
							)
						},
						...myTeam!.members
							.filter( player => player.hand.length > 0 && player.id !== loggedInPlayer?.id )
							.map( ( player, i ) => {
								const alreadySelectedCardHand = CardHand.from( { cards: [] } );
								for ( let j = 0; j < i; j++ ) {
									alreadySelectedCardHand.addCard( ...cardMap[ myTeam!.members[ j ].id ] );
								}
								return (
									{
										name: player.id,
										content: (
											<Fragment key = { player.id }>
												<ModalTitle
													title = { `${ sentenceCase( selectedCardSet
														|| "" ) } With ${ player.name }` }
												/>
												<MultiSelect
													values = { cardMap[ player.id ].map( card => (
														{ label: card.id, value: card }
													) ) }
													onChange = { handleCardSelect( player.id ) }
													options = { cardOptions
														.filter( cardOption => !alreadySelectedCardHand.contains(
															cardOption ) )
														.map( card => ( { label: card.id, value: card } ) )
													}
													renderOption = { renderCardOption }
												/>
											</Fragment>
										)
									}
								);
							} ),
						{
							name: "confirm",
							content: (
								<Fragment>
									<ModalTitle
										title = { `Confirm Call for ${ sentenceCase( selectedCardSet || "" ) }` }/>
								</Fragment>
							)
						}
					] }
					onEnd = { handleConfirm }
					isLoading = { isLoading }
				/>
			</Modal>
		</Fragment>
	);
}