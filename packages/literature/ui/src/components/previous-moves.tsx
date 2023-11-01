import { Button, Flex, Modal, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Card } from "@s2h/ui";
import { Fragment } from "react";
import { useMoves } from "../store";

export function PreviousMoves() {
	const moves = useMoves();
	const [ opened, { open, close } ] = useDisclosure();

	return (
		<Fragment>
			<Flex justify={ "center" }>
				<Button color={ "info" } onClick={ open } fw={ 700 }>PREVIOUS MOVES</Button>
			</Flex>
			<Modal
				opened={ opened }
				onClose={ close }
				title={ <Title order={ 2 }>Previous Moves</Title> }
				size={ "xl" }
				centered
			>
				<Stack>
					{ moves.slice( 0, 4 ).map( move => (
						<Card key={ move.id }>{ move.description }</Card>
					) ) }
				</Stack>
			</Modal>
		</Fragment>
	);
}