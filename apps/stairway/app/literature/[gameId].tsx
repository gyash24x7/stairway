import { Box, Center, HStack, Text, VStack } from "@gluestack-ui/themed";
import {
	AddBots,
	AskCard,
	CallSet,
	CreateTeams,
	DisplayTeams,
	ExecuteBotMove,
	GameCode,
	LiteratureContextProvider,
	PlayerLobby,
	PreviousMoves,
	StartGame,
	TransferTurn,
	useCurrentTurn,
	useGameEventHandlers,
	useGameId,
	useGameStatus,
	useHand,
	useLastMove,
	usePlayerId,
	usePlayers,
	usePlayerSpecificEventHandlers
} from "@literature/ui";
import { DisplayHand, initializeSocket } from "@shared/ui";
import { useEffect, useMemo } from "react";
import { io } from "socket.io-client";

export default function LiteratureGameScreen() {
	return (
		<LiteratureContextProvider>
			<VStack width={ "100%" } justifyContent={ "center" } p={ "$3" } mb={ "$20" } gap={ "$3" }>
				<GameCode/>
				<GamePageContent/>
			</VStack>
		</LiteratureContextProvider>
	);
}

function GamePageContent() {
	const gameId = useGameId();
	const status = useGameStatus();
	const currentTurn = useCurrentTurn();
	const playerId = usePlayerId();
	const players = usePlayers();
	const hand = useHand();
	const lastMove = useLastMove();
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
		const socket = io( `https://stairway-backend-production.up.railway.app/literature` );
		const unsubscribe = initializeSocket( socket, gameId, playerId, gameEventHandlers, playerEventHandlers );
		return () => unsubscribe();
	}, [ gameId, playerId ] );

	return (
		<VStack justifyContent={ "space-between" } gap={ "$3" }>
			{ !areTeamsCreated ? <PlayerLobby/> : <DisplayTeams/> }
			{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
			{ status === "IN_PROGRESS" && !!lastMove && (
				<Box borderWidth={ 2 } p={ "$3" } borderRadius={ "$md" } borderColor={ "$borderDark100" }>
					<Text>{ lastMove.description }</Text>
				</Box>
			) }
			{ status === "IN_PROGRESS" && (
				<Box borderWidth={ "$2" } borderColor={ "$borderDark100" } borderRadius={ "$md" } p={ "$3" }>
					<Text fontWeight={ "$bold" } size={ "lg" }>
						IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
					</Text>
				</Box>
			) }
			<VStack gap={ "$3" }>
				{ status === "CREATED" && playerId === currentTurn && <AddBots/> }
				{ status === "PLAYERS_READY" && playerId === currentTurn && <CreateTeams/> }
				{ status === "TEAMS_CREATED" && playerId === currentTurn && <StartGame/> }
				{ status === "IN_PROGRESS" && playerId === currentTurn && (
					<HStack gap={ "$3" }>
						<AskCard/>
						<CallSet/>
					</HStack>
				) }
				{ status === "IN_PROGRESS" && isLastMoveSuccessfulCall && playerId === currentTurn && (
					<TransferTurn/>
				) }
				{ status === "IN_PROGRESS" && (
					<HStack gap={ "$3" }>
						{ players[ currentTurn ].isBot && <ExecuteBotMove/> }
						<PreviousMoves/>
					</HStack>
				) }
				{ status === "COMPLETED" && (
					<Center borderWidth={ "$2" } borderColor={ "$borderDark100" } borderRadius={ "$md" } p={ "$3" }>
						<Text fontWeight={ "$bold" } size={ "6xl" } color={ "$green600" }>
							Game Completed
						</Text>
					</Center>
				) }
			</VStack>
		</VStack>
	);
}