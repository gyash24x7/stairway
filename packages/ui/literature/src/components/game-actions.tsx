"use client";

import { Button, Spinner } from "@base/ui";
import { useServerAction } from "zsa-react";
import { addBotsAction, executeBotMoveAction, startGameAction } from "../actions";
import { useGameId } from "../store";

export const AddBots = () => {
	const gameId = useGameId();
	const { isPending, execute } = useServerAction( addBotsAction );

	return (
		<Button onClick={ () => execute( { gameId } ) }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
};

export const StartGame = () => {
	const gameId = useGameId();
	const { isPending, execute } = useServerAction( startGameAction );

	return (
		<Button onClick={ () => execute( { gameId } ) }>
			{ isPending ? <Spinner/> : "START GAME" }
		</Button>
	);
};

export const ExecuteBotMove = () => {
	const gameId = useGameId();
	const { isPending, execute } = useServerAction( executeBotMoveAction );

	return (
		<Button onClick={ () => execute( { gameId } ) }>
			{ isPending ? <Spinner/> : "EXECUTE BOT MOVE" }
		</Button>
	);
};