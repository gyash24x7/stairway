import { initializeSocket } from "@/utils/socket.ts";
import { GamePage } from "@literature/components";
import {
	client,
	useGameEventHandlers,
	useGameId,
	useGameStore,
	usePlayerId,
	usePlayerSpecificEventHandlers
} from "@literature/store";
import { CardHand } from "@stairway/cards";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute( "/literature/$gameId" )( {
	beforeLoad: ( { context } ) => {
		if ( !context.authInfo ) {
			throw redirect( { to: "/" } );
		}
	},
	loader: async ( { params: { gameId } } ) => {
		const data = await client.getGameData.query( { gameId } );
		useGameStore.setState( state => ( { ...state, data: { ...data, hand: CardHand.from( data.hand ) } } ) );
		return data;
	},
	component: () => {
		const playerId = usePlayerId();
		const gameId = useGameId();
		const gameEventHandlers = useGameEventHandlers();
		const playerEventHandlers = usePlayerSpecificEventHandlers();

		useEffect( () => {
			const unsubscribe = initializeSocket(
				"/literature",
				gameId,
				playerId,
				gameEventHandlers,
				playerEventHandlers
			);
			return () => unsubscribe();
		}, [] );

		return <GamePage/>;
	}
} );
