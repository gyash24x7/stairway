import { Box, Button, Flex, Modal, Stack } from "@mantine/core";
import { Fragment } from "react";
import { useGameStore } from "../utils";
import { useDisclosure } from "@mantine/hooks";
import { gameStatusClassnames } from "../styles";

export function PreviousMoves() {
	const moves = useGameStore( state => state.gameData!.moves );
	const [ opened, { open, close } ] = useDisclosure();

	return (
		<Fragment>
			<Flex justify={ "center" }>
				<Button color={ "info" } onClick={ open }>Previous Moves</Button>
			</Flex>
			<Modal opened={ opened } onClose={ close } title={ "Previous Moves" }>
				<Stack>
					{ moves.slice( 0, 4 ).map( move => (
						<Box className={ gameStatusClassnames.banner } key={ move.id }>
							{ move.description }
						</Box>
					) ) }
				</Stack>
			</Modal>
		</Fragment>
	);
}