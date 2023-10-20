import { Button, Modal, Stack } from "@mantine/core";
import { Fragment, useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { SelectPlayer } from "./select-player";
import { useCurrentGame, useCurrentPlayer } from "../utils";
import { useTransferChanceMutation } from "@literature/client";

export function TransferChance() {
	const { myTeam, players, id } = useCurrentGame();
	const player = useCurrentPlayer();
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ opened, { open, close } ] = useDisclosure();

	const { mutateAsync, isPending } = useTransferChanceMutation( id, {
		onSuccess: () => {
			setSelectedPlayer( undefined );
			close();
		}
	} );

	const transferTurn = () => mutateAsync( { transferTo: selectedPlayer! } );

	return (
		<Fragment>
			<Modal
				opened={ opened }
				onClose={ close }
				title={ "Select Player to Transfer Chance" }
				centered
				size={ "lg" }
			>
				<Stack>
					<SelectPlayer
						player={ selectedPlayer }
						setPlayer={ setSelectedPlayer }
						options={ myTeam?.members.filter( memberId => memberId !== player.id )
							.map( memberId => players[ memberId ] ) ?? [] }
					/>
					<Button disabled={ !selectedPlayer } onClick={ transferTurn } loading={ isPending }>
						Transfer Chance
					</Button>
				</Stack>
			</Modal>
			<Button color={ "alt" } onClick={ open }>Transfer Chance</Button>
		</Fragment>
	);
}