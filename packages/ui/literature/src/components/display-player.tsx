import type { Player } from "@backend/literature/src/literature.types";
import { Avatar, AvatarImage, Box, Heading, HStack, Text, VStack } from "@gluestack-ui/themed";

export const DisplayPlayer = ( { player }: { player: Player } ) => {
	return (
		<HStack gap={ "$2" } key={ player.id } px={ "$4" } py={ "$2" } alignItems={ "center" }>
			<Avatar size="xs" borderRadius="$full">
				<AvatarImage source={ { uri: player.avatar } } alt={ "" }/>
			</Avatar>
			<Heading size="lg">{ player.name }</Heading>
		</HStack>
	);
};

export const DisplayPlayerVertical = ( { player }: { player: Player } ) => {
	return (
		<VStack gap={ "$2" } key={ player.id } px={ "$4" } py={ "$2" } alignItems={ "center" }>
			<Avatar size="xs" borderRadius="$full">
				<AvatarImage source={ { uri: player.avatar } } alt={ "" }/>
			</Avatar>
			<Heading size="lg">{ player.name }</Heading>
		</VStack>
	);
};

export const DisplayPlayerWithCardCount = ( { player, cardCount }: { player: Player, cardCount: number } ) => {
	return (
		<HStack gap={ "$3" } key={ player.id } px={ "$4" } py={ "$2" } alignItems={ "center" } w={ "100%" }
				$web-w={ "unset" }>
			<Avatar size="md" borderRadius="$full">
				<AvatarImage source={ { uri: player.avatar } } alt={ "" }/>
			</Avatar>
			<Box>
				<Heading size="lg">{ player.name }</Heading>
				<Text>{ cardCount ?? 0 } Cards</Text>
			</Box>
		</HStack>
	);
};