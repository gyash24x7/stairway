"use client";

import { usePlayers } from "../store";
import { DisplayPlayer } from "./display-player";

export const PlayerLobby = () => {
	const players = usePlayers();
	return (
		<div className={ "border-2 border-gray-300 rounded-md p-3" }>
			<h1>PLAYERS JOINED</h1>
			<div className={ "flex items-center gap-2 flex-wrap py-2" }>
				{ Object.values( players ).map( player => <DisplayPlayer player={ player } key={ player.id }/> ) }
			</div>
		</div>
	);
};