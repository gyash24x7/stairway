import { AggregatedGameData, IAggregatedGameData } from "@literature/data";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "@auth/ui";

// @ts-ignore
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { useGetGameQuery } from "@literature/client";

const litGameContext = createContext<AggregatedGameData>( null! );

export const useCurrentGame = () => {
	const ctx = useContext( litGameContext );
	return ctx.game;
};

export const useCurrentPlayer = () => {
	const { game, playerId } = useContext( litGameContext );
	return game.players[ playerId ];
};

export const useCurrentGameTeams = () => {
	const { teams, teamList } = useCurrentGame();
	const currentPlayer = useCurrentPlayer();

	return teamList.length !== 0 && !!currentPlayer
		? {
			myTeam: teams[ currentPlayer.teamId! ],
			oppositeTeam: teamList.find( team => team.name !== currentPlayer.teamId )
		}
		: {};
};

export const useCurrentGameHandData = () => {
	const { hand } = useContext( litGameContext );
	const askableCardSets = hand?.cardSetsInHand.filter( cardSet => hand.getCardsOfSet( cardSet ).length !== 6 ) ?? [];
	const callableCardSets = hand?.cardSetsInHand ?? [];
	return { hand, askableCardSets, callableCardSets };
};

export const useCurrentGameMoves = () => {
	const ctx = useContext( litGameContext );
	return ctx.moves;
};

export const useCurrentGameCardCounts = () => {
	const ctx = useContext( litGameContext );
	return ctx.cardCounts;
};

export function GameProvider( props: { children: ReactNode } ) {
	const [ gameData, setGameData ] = useState<AggregatedGameData>();
	const { gameId } = useParams();
	const { user } = useAuth();

	useGetGameQuery( gameId!, {
		onSuccess( data ) {
			setGameData( AggregatedGameData.from( data ) );
		}
	} );

	useEffect( () => {
		const socket = io( "http://localhost:8000/literature" );
		socket.on( "welcome", ( data: string ) => {
			console.log( data );
		} );

		socket.on( gameId + user!.id, ( data: IAggregatedGameData ) => {
			setGameData( AggregatedGameData.from( data ) );
		} );

		return () => {
			socket.close();
		};
	}, [] );

	return <litGameContext.Provider value={ gameData! }>{ props.children }</litGameContext.Provider>;
}
