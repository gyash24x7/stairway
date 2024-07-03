import { Box, Heading, HStack } from "@gluestack-ui/themed";
import { usePlayers } from "../store";
import { DisplayPlayer } from "./display-player";

export const PlayerLobby = () => {
	const players = usePlayers();
	return (
		<Box borderWidth={ "$2" } borderColor={ "$borderDark100" } borderRadius={ "$md" } p={ "$3" }>
			<Heading>PLAYERS JOINED</Heading>
			<HStack alignItems={ "center" } gap={ "$2" } py={ "$2" } flexWrap={ "wrap" }>
				{ Object.values( players ).map( player => <DisplayPlayer player={ player } key={ player.id }/> ) }
			</HStack>
		</Box>
	);
};