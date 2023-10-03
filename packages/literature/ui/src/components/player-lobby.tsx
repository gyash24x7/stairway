import { Fragment } from "react";
import { useCurrentGameCardCounts } from "../utils";
import { Avatar, Box, Flex, Text, Title } from "@mantine/core";
import type { Player } from "@literature/prisma";

export interface PlayerLobbyProps {
	playerList: Player[];
	displayHeading?: boolean;
	displayCardCount?: boolean;
}

export function PlayerLobby( { playerList, displayHeading, displayCardCount }: PlayerLobbyProps ) {
	const cardCounts = useCurrentGameCardCounts();
	return (
		<Box my={ 8 } w={ "100%" }>
			{ !!displayHeading && <Title order={ 4 }>Players Joined</Title> }
			{ playerList.map( player => (
				<Fragment key={ player.id }>
					<Flex py={ 8 } w={ "100%" } align={ "center" } gap={ "md" }>
						<Avatar size={ "xs" } src={ player.avatar }/>
						<Text>{ player.name }</Text>
					</Flex>
					{ !!displayCardCount && (
						<Box w={ 28 }>
							<Text ta={ "right" }>
								{ cardCounts[ player.id ] } Cards
							</Text>
						</Box>
					) }
				</Fragment>
			) ) }
		</Box>
	);
}