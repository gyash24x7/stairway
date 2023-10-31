import { Avatar, Group, Stack, Text } from "@mantine/core";
import type { Player } from "@literature/types";
import { useGameData } from "../utils";

export type DisplayPlayerProps = {
	player: Player;
	displayCardCount?: boolean;
}

export function DisplayPlayerSmall( { player, displayCardCount }: DisplayPlayerProps ) {
	const { cardCounts } = useGameData()!;
	return (
		<Group align={ "center" }>
			<Avatar size={ 28 } src={ player.avatar }/>
			<Text fz={ 16 } fw={ 700 } lh={ 2 }>{ player.name.toUpperCase() }</Text>
			{ !!displayCardCount && Object.values( cardCounts ).some( count => count > 0 ) && (
				<Text ta={ "right" } style={ { flex: 1 } } fz={ 14 }>{ cardCounts[ player.id ] } Cards</Text>
			) }
		</Group>
	);
}

export function DisplayPlayerMedium( { player }: DisplayPlayerProps ) {
	return (
		<Group align={ "center" }>
			<Avatar size={ 36 } src={ player.avatar }/>
			<Text fz={ 20 } fw={ 600 } lh={ 2 }>{ player.name }</Text>
		</Group>
	);
}

export function DisplayPlayerVertical( { player }: DisplayPlayerProps ) {
	return (
		<Stack align={ "center" }>
			<Avatar size={ 56 } src={ player.avatar }/>
			<Text fz={ 14 } fw={ 600 } lh={ 2 }>{ player.name }</Text>
		</Stack>
	);
}