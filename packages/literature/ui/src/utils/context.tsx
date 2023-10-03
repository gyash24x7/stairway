import type { PlayerSpecificGameData } from "@literature/data";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "@auth/ui";
// @ts-ignore
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { useGetGameQuery } from "@literature/client";
import { getCardSetsInHand, getCardsOfSet } from "@s2h/cards";

const litGameContext = createContext<PlayerSpecificGameData>( null! );

export const useCurrentGame = () => useContext( litGameContext );

export const useCurrentPlayer = () => {
	const { user } = useAuth();
	const { players } = useContext( litGameContext );
	return players[ user?.id! ];
};

export const useCurrentGameHandData = () => {
	const { hand } = useContext( litGameContext );
	const cardSetsInHand = getCardSetsInHand( hand );
	const askableCardSets = cardSetsInHand.filter( cardSet => getCardsOfSet( hand, cardSet ).length !== 6 ) ?? [];
	const callableCardSets = cardSetsInHand;
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
	const [ gameData, setGameData ] = useState<PlayerSpecificGameData>();
	const { gameId } = useParams();
	const { user } = useAuth();

	useGetGameQuery( gameId!, {
		onSuccess( data ) {
			setGameData( data );
		}
	} );

	useEffect( () => {
		const socket = io( "http://localhost:8000/literature" );
		socket.on( "welcome", ( data: string ) => {
			console.log( data );
		} );

		socket.on( gameId + user!.id, ( data: PlayerSpecificGameData ) => {
			setGameData( data );
		} );

		return () => {
			socket.close();
		};
	}, [] );

	return <litGameContext.Provider value={ gameData! }>{ props.children }</litGameContext.Provider>;
}
