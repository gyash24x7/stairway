import type { Player } from "@literature/types";
import { Avatar, Box, Group, Title } from "@mantine/core";

export interface PlayerCardProps {
	player: Player;
}

export function PlayerCard( { player }: PlayerCardProps ) {
	return (
		<Group wrap={ "nowrap" }>
			<Avatar src={ player.avatar } size={ 32 } radius={ "50%" }/>
			<Box>
				<Title order={ 4 }>{ player.name }</Title>
			</Box>
		</Group>
	);
}