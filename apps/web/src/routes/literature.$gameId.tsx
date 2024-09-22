import { initializeSocket } from "@/utils/socket.ts";
import {
	AddBots,
	AskCardDialog,
	CallSetDialog,
	CreateTeamsDialog,
	DisplayHand,
	DisplayTeams,
	ExecuteBotMove,
	GameCode,
	PlayerLobby,
	PreviousAsks,
	StartGame,
	TransferTurnDialog
} from "@literature/components";
import {
	useCurrentTurn,
	useGameEventHandlers,
	useGameId,
	useGameStatus,
	useGameStore,
	useIsLastMoveSuccessfulCall,
	useLastMove,
	usePlayerId,
	usePlayers,
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
		const currentTurn = useCurrentTurn();
		const playerId = usePlayerId();
		const players = usePlayers();
		const lastMove = useLastMove();
		const gameId = useGameId();
		const gameEventHandlers = useGameEventHandlers();
		const playerEventHandlers = usePlayerSpecificEventHandlers();
		const isLastMoveSuccessfulCall = useIsLastMoveSuccessfulCall();

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
				<div className={ "flex flex-col gap-3 justify-between" }>
					{ !areTeamsCreated ? <PlayerLobby/> : <DisplayTeams/> }
					{ status === "IN_PROGRESS" && <DisplayHand/> }
					{ status === "IN_PROGRESS" && !!lastMove && (
						<div className={ "p-3 border-2 border-gray-300 rounded-md" }>
							<p>{ lastMove.description }</p>
						</div>
					) }
					{ status === "IN_PROGRESS" && (
						<div className={ "p-3 border-2 border-gray-300 rounded-md" }>
							<p className={ "text-xl font-bold" }>
								IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
							</p>
						</div>
					) }
					<div className={ "flex flex-col gap-3" }>
						{ status === "CREATED" && playerId === currentTurn && <AddBots gameId={ gameId }/> }
						{ status === "PLAYERS_READY" && playerId === currentTurn && <CreateTeamsDialog/> }
						{ status === "TEAMS_CREATED" && playerId === currentTurn && <StartGame gameId={ gameId }/> }
						{ status === "IN_PROGRESS" && playerId === currentTurn && (
							<div className={ "flex gap-3" }>
								<AskCardDialog/>
								<CallSetDialog/>
								{ isLastMoveSuccessfulCall && <TransferTurnDialog/> }
							</div>
						) }
						{ status === "IN_PROGRESS" && (
							<div className={ "flex gap-3" }>
								{ players[ currentTurn ].isBot && <ExecuteBotMove gameId={ gameId }/> }
								<PreviousAsks/>
							</div>
						) }
						{ status === "COMPLETED" && (
							<div
								className={ "p-3 border-2 border-gray-300 rounded-md flex justify-center items-center" }>
								<p className={ "font-bold text-6xl text-green-600" }>
									Game Completed
								</p>
							</div>
						) }
					</div>
				</div>
			</div>
		);
	}
} );
