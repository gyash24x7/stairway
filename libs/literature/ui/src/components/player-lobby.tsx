import { Avatar, HStack } from "@s2h/ui";

import { useGame } from "../utils";

export function PlayerLobby() {
	const { playerList } = useGame();
	return (
		<div className={ "min-w-full my-2" }>
			<h4 className={ "font-semibold text-lg text-left" }>Players Joined</h4>
			{ playerList.map( player => (
				<HStack className={ "py-2" } key={ player.id }>
					<Avatar size={ "xs" } name={ player.name } src={ player.avatar }/>
					<h4 className={ "text-base" }>{ player.name }</h4>
				</HStack>
			) ) }
		</div>
	);
}