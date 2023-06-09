import { ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import { createContext, ReactNode, useContext, useState } from "react";
import { useMount } from "react-use";
import { io } from "socket.io-client";
import { useAuth } from "./auth";
import { useLoaderData, useParams } from "react-router-dom";

const litGameContext = createContext<LiteratureGame>( null! );

export const useGame = () => useContext( litGameContext );
export const useCurrentPlayer = () => {
	const { players } = useGame();
	const { user } = useAuth();
	return !!user ? players[ user.id ] : undefined;
};
export const useCurrentGameTeams = () => {
	const { teams, teamList } = useGame();
	const currentPlayer = useCurrentPlayer();

	return teamList.length !== 0 && !!currentPlayer
		? {
			myTeam: teams[ currentPlayer.teamId! ],
			oppositeTeam: teamList.find( team => team.name !== currentPlayer.teamId )
		}
		: {};
};

export function GameProvider( props: { children: ReactNode } ) {
	const game = useLoaderData() as ILiteratureGame;
	const [ ctx, setCtx ] = useState( LiteratureGame.from( game ) );
	const params = useParams();

	useMount( () => {
		const socket = io( "http://localhost:8000/literature" );
		socket.on( "welcome", ( data ) => {
			console.log( data );
		} );

		socket.on( params[ "gameId" ]!, ( data: ILiteratureGame ) => {
			setCtx( LiteratureGame.from( data ) );
		} );

		return () => socket.close();
	} );

	return (
		<litGameContext.Provider value={ ctx }>
			{ props.children }
		</litGameContext.Provider>
	);
}