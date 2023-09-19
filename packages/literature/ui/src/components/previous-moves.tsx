import { Box, Button, Flex, Modal, Stack } from "@mantine/core";
import { Fragment } from "react";
import { useCurrentGame, useCurrentGameMoves } from "../utils";
import { LiteratureMove } from "@literature/data";
import { useDisclosure } from "@mantine/hooks";

export function PreviousMoves() {
	const moves = useCurrentGameMoves();
	const { players } = useCurrentGame();

	const [ opened, { open, close } ] = useDisclosure();

	return (
		<Fragment>
			<Flex justify={ "center" }>
				<Button color={ "light" } onClick={ open }>Previous Moves</Button>
			</Flex>
			<Modal opened={ opened } onClose={ close } title={ "Previous Moves" }>
				<Stack>
					{ moves.slice( 0, 4 ).map( move => (
						<Box bg={ "light" } p={ 16 } w={ "100%" }>
							{ LiteratureMove.getMoveDescription( move, players ) }
						</Box>
					) ) }
				</Stack>
			</Modal>
		</Fragment>
	);
}