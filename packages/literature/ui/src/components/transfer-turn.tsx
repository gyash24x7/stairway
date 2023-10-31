import { Button, Modal, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Fragment, useCallback, useState } from "react";
import { useGameData, usePlayerData, useTransferTurnAction } from "../utils";
import { SelectPlayer } from "./select-player";

export function TransferTurn() {
	const { teams, players, id: gameId } = useGameData()!;
	const { id: playerId, teamId } = usePlayerData()!;
	const myTeam = teams[ teamId! ];

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ opened, { open, close } ] = useDisclosure();
	const { execute, isLoading } = useTransferTurnAction();

	const closeModal = useCallback( () => {
		setSelectedPlayer( undefined );
		close();
	}, [] );

	const handleSubmit = useCallback(
		() => execute( { transferTo: selectedPlayer!, gameId } )
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
						options={ myTeam?.members.filter( memberId => memberId !== playerId )
							.map( memberId => players[ memberId ] ) ?? [] }
					/>
					<Button disabled={ !selectedPlayer } onClick={ handleSubmit } loading={ isLoading }>
						Transfer Turn
					</Button>
				</Stack>
			</Modal>
			<Button color={ "alt" } onClick={ open } fw={ 700 }>TRANSFER TURN</Button>
		</Fragment>
	);
}