import { Fragment, useState } from "react";
import { trpc } from "../utils/trpc";
import { Banner, Button, Flex, HStack, Modal, ModalTitle, SingleSelect, Stepper } from "@s2h/ui";
import { useGame } from "../utils/game-context";
import { cardSetSrcMap, DisplayCard } from "./display-card";
import { PlayerCard } from "./player-card";
import type { AskCardInput } from "@s2h/literature/dtos";
import { askCardInputStruct } from "@s2h/literature/dtos";
import type { CardSet, PlayingCard } from "@s2h/cards";
import { cardSetMap } from "@s2h/cards";
import type { EnhancedLitPlayer } from "@s2h/literature/utils";

export function AskCard() {
	const { loggedInPlayer, askableCardSets, oppositeTeam, id: gameId } = useGame();

	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ selectedCardSet, setSelectedCardSet ] = useState<CardSet>();
	const [ selectedCard, setSelectedCard ] = useState<PlayingCard>();
	const [ selectedPlayer, setSelectedPlayer ] = useState<EnhancedLitPlayer>();

	const { mutateAsync, isLoading } = trpc.useMutation( "ask-card", {
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const handleConfirm = async () => {
		const input: AskCardInput = { gameId, askedFor: selectedCard!, askedFrom: selectedPlayer!.id };
		const [ error ] = askCardInputStruct.validate( input );

		if ( !error ) {
			await mutateAsync( input );
		} else {
			console.log( error );
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

	const renderCardOption = ( card: PlayingCard ) => <DisplayCard card = { card }/>;

	const renderPlayerOption = ( player: EnhancedLitPlayer ) => <PlayerCard player = { player }/>;

	const openModal = () => setIsModalOpen( true );

	const closeModal = () => {
		setSelectedCardSet( undefined );
		setSelectedCard( undefined );
		setSelectedPlayer( undefined );
		setIsModalOpen( false );
	};

	return (
		<Fragment>
			<Flex justify = { "center" }>
				<Button buttonText = { "Ask Card" } appearance = { "alt" } onClick = { openModal }/>
			</Flex>
			<Modal isOpen = { isModalOpen } onClose = { closeModal }>
				<Stepper
					steps = { [
						{
							name: "selectCardSet",
							content: (
								<Fragment>
									<ModalTitle title = { "Select Card Set to Ask From" }/>
									<SingleSelect
										value = { selectedCardSet }
										onChange = { setSelectedCardSet }
										options = { askableCardSets }
										renderOption = { renderCardSetOption }
									/>
								</Fragment>
							)
						},
						{
							name: "selectCard",
							content: (
								<Fragment>
									<ModalTitle title = { "Select Card to Ask" }/>
									<SingleSelect
										value = { selectedCard }
										onChange = { setSelectedCard }
										options = { !selectedCardSet ? [] : cardSetMap[ selectedCardSet ]
											.filter( card => !loggedInPlayer?.hand.contains( card ) )
										}
										renderOption = { renderCardOption }
									/>
								</Fragment>
							)
						},
						{
							name: "selectPlayer",
							content: (
								<Fragment>
									<ModalTitle title = { "Select Player to Ask From" }/>
									<SingleSelect
										value = { selectedPlayer }
										onChange = { setSelectedPlayer }
										options = { oppositeTeam?.membersWithCards || [] }
										renderOption = { renderPlayerOption }
									/>
								</Fragment>
							)
						},
						{
							name: "confirm",
							content: (
								<Fragment>
									<ModalTitle title = { "Confirm your Ask" }/>
									<Banner
										message = { `Ask ${ selectedPlayer?.name } for ${ selectedCard?.cardString }` }
									/>
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