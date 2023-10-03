import { useCurrentGameCardCounts } from "../utils";
import { Avatar, Box, Group, Text, Title } from "@mantine/core";
import type { Player } from "@literature/prisma";

export interface PlayerCardProps {
	player: Player;
}

export function PlayerCard( { player }: PlayerCardProps ) {
	const cardCounts = useCurrentGameCardCounts();
	return (
		<Group wrap={ "nowrap" }>
			<Avatar src={ player.avatar } size={ 48 } radius={ "50%" }/>
			<Box>
				<Title order={ 5 }>{ player.name }</Title>
				<Text fz={ "xs" } c={ "dimmed" } mt={ 3 }>{ cardCounts[ player.id ] }</Text>
			</Box>
		</Group>
	);
}