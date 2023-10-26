import { Button, Modal, Stack } from "@mantine/core";
import { Fragment, useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { SelectPlayer } from "./select-player";
import { useAction } from "@s2h/ui";
import { transferTurn, useGameStore } from "../utils";

export function TransferTurn() {
	const teams = useGameStore( state => state.gameData!.teams );
	const players = useGameStore( state => state.gameData!.players );
	const playerId = useGameStore( state => state.playerData!.id );
	const teamId = useGameStore( state => state.playerData!.teamId );
	const gameId = useGameStore( state => state.gameData!.id );
	const myTeam = teams[ teamId! ];

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ opened, { open, close } ] = useDisclosure();
	const { execute, isLoading } = useAction( transferTurn );

	const closeModal = () => {
		setSelectedPlayer( undefined );
		close();
	};

	const handleSubmit = () => execute( { transferTo: selectedPlayer!, gameId } )
		.then( closeModal )
		.catch( error => alert( error.message ) );

	return (
		<Fragment>
			<Modal
				opened={ opened }
				onClose={ close }
				title={ "Select Player to Transfer Turn" }
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
			<Button color={ "alt" } onClick={ open }>Transfer Turn</Button>
		</Fragment>
	);
}