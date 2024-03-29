import { Card } from "@common/ui";
import type { Player } from "@literature/data";
import { Title } from "@mantine/core";
import { DisplayPlayerSmall } from "./display-player";

export interface PlayerLobbyProps {
	playerList: Player[];
	displayHeading?: boolean;
	displayCardCount?: boolean;
}

export function PlayerLobby( { playerList, displayHeading, displayCardCount }: PlayerLobbyProps ) {
	return (
		<Card stretch>
			{ !!displayHeading && <Title order={ 2 } pb={ 8 }>Players</Title> }
			{ playerList.map( player => (
				<DisplayPlayerSmall key={ player.id } player={ player } displayCardCount={ displayCardCount }/>
			) ) }
		</Card>
	);
}