import { Button, Modal, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Fragment, useCallback, useState } from "react";
import { useGameId, useMyTeam, usePlayerId, usePlayers, useTransferTurnAction } from "../store";
import { SelectPlayer } from "./select-player";

export function TransferTurn() {
	const gameId = useGameId();
	const myTeam = useMyTeam();
	const players = usePlayers();
	const playerId = usePlayerId();

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ opened, { open, close } ] = useDisclosure();
	const { mutateAsync, isPending } = useTransferTurnAction();

	const closeModal = useCallback( () => {
		setSelectedPlayer( undefined );
		close();
	}, [] );

	const handleSubmit = useCallback(
		() => mutateAsync( { transferTo: selectedPlayer!, gameId } )
			.catch( error => alert( error.message ) )
			.finally( closeModal ),
		[ selectedPlayer, gameId ]
	);

	return (
		<Fragment>
			<Modal
				opened={ opened }
				onClose={ close }
				title={ <Title order={ 2 }>Select Player to Transfer Turn</Title> }
				centered
				size={ "lg" }
			>
				<Stack>
					<SelectPlayer
						player={ selectedPlayer }
						setPlayer={ setSelectedPlayer }
						options={ myTeam?.memberIds.filter( memberId => memberId !== playerId )
							.map( memberId => players[ memberId ] ) ?? [] }
					/>
					<Button disabled={ !selectedPlayer } onClick={ handleSubmit } loading={ isPending }>
						Transfer Turn
					</Button>
				</Stack>
			</Modal>
			<Button color={ "alt" } onClick={ open } fw={ 700 }>TRANSFER TURN</Button>
		</Fragment>
	);
}