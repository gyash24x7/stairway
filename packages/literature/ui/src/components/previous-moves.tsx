import { Box, Button, Flex, Modal, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Fragment } from "react";
import { gameStatusClassnames } from "../styles";
import { useGameStore } from "../utils";

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