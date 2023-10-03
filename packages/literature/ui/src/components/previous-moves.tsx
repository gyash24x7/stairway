import { Box, Button, Flex, Modal, Stack } from "@mantine/core";
import { Fragment } from "react";
import { useCurrentGameMoves } from "../utils";
import { useDisclosure } from "@mantine/hooks";

export function PreviousMoves() {
	const moves = useCurrentGameMoves();

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
							{ move.description }
						</Box>
					) ) }
				</Stack>
			</Modal>
		</Fragment>
	);
}