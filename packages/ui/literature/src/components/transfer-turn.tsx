import {
	Button,
	ButtonSpinner,
	ButtonText,
	Heading,
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
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useCardCounts, useGameId, useMyTeam, usePlayerId, usePlayers, useTransferTurnMutation } from "../store";
import { SelectPlayer } from "./select-player";

export const TransferTurn = () => {
	const gameId = useGameId();
	const myTeam = useMyTeam();
	const players = usePlayers();
	const playerId = usePlayerId();
	const cardCounts = useCardCounts();

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ showModal, setShowModal ] = useState( false );
	const ref = useRef( null );

	const myTeamMembersWithCards = useMemo( () => {
		return myTeam?.memberIds.map( memberId => players[ memberId ] )
			.filter( member => !!cardCounts[ member.id ] && member.id !== playerId ) ?? [];
	}, [ myTeam, cardCounts, players ] );

	const openModal = () => setShowModal( true );
	const closeModal = () => setShowModal( false );

	const { mutateAsync, isPending } = useTransferTurnMutation();
	const handleSubmit = useCallback(
		() => mutateAsync( { transferTo: selectedPlayer!, gameId } )
			.catch( error => alert( error.message ) )
			.finally( closeModal ),
		[ selectedPlayer, gameId ]
	);

	return (
		<Fragment>
			<Button flex={ 1 } onPress={ openModal }>
				<ButtonText>TRANSFER TURN</ButtonText>
			</Button>
			<Modal isOpen={ showModal } onClose={ closeModal } finalFocusRef={ ref }>
				<ModalBackdrop/>
				<ModalContent>
					<ModalHeader>
						<Heading size="lg">Transfer Turn</Heading>
						<ModalCloseButton>
							<Icon as={ X }/>
						</ModalCloseButton>
					</ModalHeader>
					<ModalBody>
						<SelectPlayer
							options={ myTeamMembersWithCards }
							setPlayer={ setSelectedPlayer }
							player={ selectedPlayer }
						/>
					</ModalBody>
					<ModalFooter>
						<Button flex={ 1 } onPress={ handleSubmit }>
							{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>TRANSFER TURN</ButtonText> }
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Fragment>
	);
};