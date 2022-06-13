import { Avatar, HStack } from "@s2h/ui";
import { useGame } from "../utils/game-context";

export function PlayerLobby() {
	const { players } = useGame();
	return (
		<div className = { "min-w-full my-2" }>
			<h4 className = { "font-semibold text-lg text-left" }>Players Joined</h4>
			{ players.map( player => (
				<HStack className = { "py-2" } key = { player.id }>
					<Avatar size = { "xs" } name = { player.name } src = { player.avatar }/>
					<h4 className = { "text-base" }>{ player.name }</h4>
				</HStack>
			) ) }
		</div>
	);
}