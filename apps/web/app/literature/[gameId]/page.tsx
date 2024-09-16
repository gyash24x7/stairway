"use client";

import {
	AddBots,
	AskCard,
	CallSet,
	CreateTeams,
	DisplayHand,
	DisplayTeams,
	ExecuteBotMove,
	GameCode,
	PlayerLobby,
	PreviousMoves,
	socket,
	StartGame,
	TransferTurn,
	useCurrentTurn,
	useGameEventHandlers,
	useGameId,
	useGameStatus,
	useLastMove,
	usePlayerId,
	usePlayers,
	usePlayerSpecificEventHandlers
} from "@literature/ui";
import { initializeSocket } from "@main/ui";
import { useEffect, useMemo } from "react";

export default function LiteratureGamePage() {
	const status = useGameStatus();
	const currentTurn = useCurrentTurn();
	const playerId = usePlayerId();
	const players = usePlayers();
	const lastMove = useLastMove();
	const gameId = useGameId();
	const gameEventHandlers = useGameEventHandlers();
	const playerEventHandlers = usePlayerSpecificEventHandlers();

	const isLastMoveSuccessfulCall = useMemo(
		() => lastMove?.type === "CALL_SET" && lastMove.success,
		[ lastMove ]
	);

	const areTeamsCreated = useMemo(
		() => status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED",
		[ status ]
	);

	useEffect( () => {
		const unsubscribe = initializeSocket( socket, gameId, playerId, gameEventHandlers, playerEventHandlers );
		return () => unsubscribe();
	}, [ gameId, playerId ] );

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
					{ status === "CREATED" && playerId === currentTurn && <AddBots/> }
					{ status === "PLAYERS_READY" && playerId === currentTurn && <CreateTeams/> }
					{ status === "TEAMS_CREATED" && playerId === currentTurn && <StartGame/> }
					{ status === "IN_PROGRESS" && playerId === currentTurn && (
						<div className={ "flex gap-3" }>
							<AskCard/>
							<CallSet/>
							{ isLastMoveSuccessfulCall && <TransferTurn/> }
						</div>
					) }
					{ status === "IN_PROGRESS" && (
						<div className={ "flex gap-3" }>
							{ players[ currentTurn ].isBot && <ExecuteBotMove/> }
							<PreviousMoves/>
						</div>
					) }
					{ status === "COMPLETED" && (
						<div className={ "p-3 border-2 border-gray-300 rounded-md flex justify-center items-center" }>
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