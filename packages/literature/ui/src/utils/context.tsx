import type {
	CardInferences,
	GameData,
	GameStatus,
	Move,
	Player,
	PlayerSpecificData,
	ScoreUpdate,
	TeamWithMembers
} from "@literature/types";
import type { PlayingCard } from "@s2h/cards";
import { LiveUpdatesProvider } from "@s2h/ui";
import { createContext, ReactNode, useContext, useState } from "react";
import { useLoaderData } from "react-router-dom";

export type LiteratureContextType = {
	gameData?: GameData;
	playerData?: PlayerSpecificData
}

export const GameContext = createContext<LiteratureContextType>( {} );

export function GameProvider( props: { children: ReactNode } ) {
	const loaderData = useLoaderData() as { gameData: GameData, playerData: PlayerSpecificData };
	const [ gameData, setGameData ] = useState( loaderData.gameData );
	const [ playerData, setPlayerData ] = useState( loaderData.playerData );

	const handlePlayerJoinedEvent = ( player: Player ) => {
		setGameData( gameData => {
			gameData.players[ player.id ] = player;
			return gameData;
		} );
	};

	const handleTeamsCreatedEvent = ( teams: Record<string, TeamWithMembers> ) => {
		setGameData( gameData => {
			gameData.teams = teams;
			return gameData;
		} );
	};

	const handleMoveCreatedEvent = ( move: Move ) => {
		setGameData( gameData => {
			gameData.moves = [ move, ...gameData.moves ];
			return gameData;
		} );
	};

	const handleTurnUpdatedEvent = ( turn: string ) => {
		setGameData( gameData => {
			gameData.currentTurn = turn;
			return gameData;
		} );
	};

	const handleScoreUpdatedEvent = ( { teamId, score, setWon }: ScoreUpdate ) => {
		setGameData( gameData => {
			gameData.teams[ teamId ].score = score;
			gameData.teams[ teamId ].setsWon.push( setWon );
			return gameData;
		} );
	};

	const handleStatusUpdatedEvent = ( status: GameStatus ) => {
		setGameData( gameData => {
			gameData.status = status;
			return gameData;
		} );
	};

	const handleCardCountUpdatedEvent = ( cardCounts: Record<string, number> ) => {
		setGameData( gameData => {
			gameData.cardCounts = cardCounts;
			return gameData;
		} );
	};

	const handleHandUpdatedEvent = ( hand: PlayingCard[] ) => {
		setPlayerData( playerData => {
			playerData.hand = hand;
			return playerData;
		} );
	};

	const handleInferencesUpdatedEvent = ( inferences: CardInferences ) => {
		setPlayerData( playerData => {
			playerData.inferences = inferences;
			return playerData;
		} );
	};

	const gameEvents = {
		PLAYER_JOINED: handlePlayerJoinedEvent,
		TEAMS_CREATED: handleTeamsCreatedEvent,
		MOVE_CREATED: handleMoveCreatedEvent,
		TURN_UPDATED: handleTurnUpdatedEvent,
		SCORE_UPDATED: handleScoreUpdatedEvent,
		STATUS_UPDATED: handleStatusUpdatedEvent,
		CARD_COUNT_UPDATED: handleCardCountUpdatedEvent
	};

	const playerEvents = {
		HAND_UPDATED: handleHandUpdatedEvent,
		INFERENCES_UPDATED: handleInferencesUpdatedEvent
	};

	return (
		<GameContext.Provider value={ { gameData, playerData } }>
			<LiveUpdatesProvider
				gameId={ gameData.id }
				playerId={ playerData.id }
				gameEvents={ gameEvents }
				playerEvents={ playerEvents }
			>
				{ props.children }
			</LiveUpdatesProvider>
		</GameContext.Provider>
	);
}

export const useGameData = () => useContext( GameContext ).gameData;
export const usePlayerData = () => useContext( GameContext ).playerData;