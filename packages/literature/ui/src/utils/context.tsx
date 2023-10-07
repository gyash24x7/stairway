import type { PlayerSpecificGameData } from "@literature/data";
import { createContext, ReactNode, useContext } from "react";
import { useAuth } from "@auth/ui";
// @ts-ignore
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { useGetGameQuery } from "@literature/client";
import { getCardSetsInHand, getCardsOfSet } from "@s2h/cards";
import { Loader } from "@mantine/core";

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
	const { gameId } = useParams();
	const { isLoading, data, error } = useGetGameQuery( gameId! );

	if ( !!error ) {
		console.log( error );
		return <div>Some Error Happened!</div>;
	}

	if ( isLoading || !data ) {
		return <Loader/>;
	}

	return (
		<litGameContext.Provider value={ data }>
			{ props.children }
		</litGameContext.Provider>
	);
}
