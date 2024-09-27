import { initializeSocket } from "@/utils/socket.ts";
import { DisplayHand, DisplayTeams, GameCode, GameCompleted, PlayerLobby } from "@literature/components";
import { ActionPanel } from "@literature/components/src/action-panel.tsx";
import {
	useGameEventHandlers,
	useGameId,
	useGameStatus,
	useGameStore,
	useLastMove,
	usePlayerId,
	usePlayerSpecificEventHandlers
} from "@literature/store";
import { CardHand } from "@stairway/cards";
import { client } from "@stairway/clients/literature";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

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
		const status = useGameStatus();
		const playerId = usePlayerId();
		const lastMove = useLastMove();
		const gameId = useGameId();
		const gameEventHandlers = useGameEventHandlers();
		const playerEventHandlers = usePlayerSpecificEventHandlers();

		const areTeamsCreated = useMemo(
			() => status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED",
			[ status ]
		);

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

		return (
			<div className={ `flex flex-col gap-3` }>
				<GameCode/>
				<div className={ "flex flex-col gap-3 justify-between mb-52" }>
					{ areTeamsCreated && <DisplayTeams/> }
					<PlayerLobby withBg withCardCount={ status === "IN_PROGRESS" }/>
					{ status === "IN_PROGRESS" && !!lastMove && (
						<div className={ "p-3 border-2 rounded-md" }>
							<p>{ lastMove.description }</p>
						</div>
					) }
					{ status === "IN_PROGRESS" && <DisplayHand/> }
					{ status === "COMPLETED" && <GameCompleted/> }
				</div>
				{ status !== "COMPLETED" && <ActionPanel/> }
			</div>
		);
	}
} );
