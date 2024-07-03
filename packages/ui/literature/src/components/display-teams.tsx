import { Box, Center, Heading, VStack } from "@gluestack-ui/themed";
import { useMemo } from "react";
import { useCardCounts, usePlayers, useTeams } from "../store";
import { DisplayPlayerWithCardCount } from "./display-player";

export const DisplayTeams = () => {
	const players = usePlayers();
	const teams = useTeams();
	const cardCounts = useCardCounts();
	const teamList = useMemo( () => Object.values( teams ), [ teams ] );

	return (
		<VStack borderWidth={ "$2" } borderColor={ "$borderDark100" } borderRadius={ "$md" }>
			<Box flexDirection={ "row" } borderBottomWidth={ "$2" } borderColor={ "$borderDark100" }>
				<Center p={ "$2" } flex={ 1 }>
					<Heading size="2xl" fontFamily={ "fjalla" }>{ teamList[ 0 ]?.name.toUpperCase() }</Heading>
				</Center>
				<Center p={ "$2" }>
					<Heading size="4xl" fontFamily={ "fjalla" }>
						{ teamList[ 0 ]?.score } - { teamList[ 1 ]?.score }
					</Heading>
				</Center>
				<Center p={ "$2" } flex={ 1 }>
					<Heading size="2xl" fontFamily={ "fjalla" }>{ teamList[ 1 ]?.name.toUpperCase() }</Heading>
				</Center>
			</Box>
			<Box flexDirection={ "row" }>
				<Center flex={ 1 } borderRightWidth={ "$2" } py={ "$2" } borderColor={ "$borderDark100" }
						flexDirection={ "row" } flexWrap={ "wrap" }>
					{ teamList[ 0 ]?.memberIds.map( playerId => (
						<DisplayPlayerWithCardCount player={ players[ playerId ] } key={ playerId }
													cardCount={ cardCounts[ playerId ] }/>
					) ) }
				</Center>
				<Center flex={ 1 } py={ "$2" } borderColor={ "$borderDark100" }
						flexDirection={ "row" } flexWrap={ "wrap" }>
					{ teamList[ 1 ]?.memberIds.map( playerId => (
						<DisplayPlayerWithCardCount player={ players[ playerId ] } key={ playerId }
													cardCount={ cardCounts[ playerId ] }/>
					) ) }
				</Center>
			</Box>
		</VStack>
	);
};