import { ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import { Flex, Spinner } from "@s2h/ui";
import { createContext, ReactNode, useContext, useState } from "react";
import { useMount, useUpdateEffect } from "react-use";
import { io } from "socket.io-client";
import { trpc } from "./trpc";
import { useAuth } from "./auth";
import { useParams } from "@tanstack/router";

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
			myTeam: teams[ currentPlayer.team! ],
			oppositeTeam: teamList.find( team => team.name !== currentPlayer.team )
		}
		: {};
};

export function GameProvider( props: { children: ReactNode } ) {
	const [ ctx, setCtx ] = useState<LiteratureGame>();
	const params = useParams();

	const { isLoading, data, error } = trpc.getGame.useQuery( { gameId: params.gameId! } );

	useUpdateEffect( () => {
		if ( !!data && !error ) {
			setCtx( LiteratureGame.from( data ) );
		}
	}, [ data, error ] );

	useMount( () => {
		const socket = io( "http://localhost:8000/literature" );
		socket.on( "welcome", ( data ) => {
			console.log( data );
		} );

		socket.on( params.gameId!, ( data: ILiteratureGame ) => {
			setCtx( LiteratureGame.from( data ) );
		} );

		return () => socket.close();
	} );

	if ( isLoading || !ctx ) {
		return (
			<Flex className={ "h-screen w-screen" } align={ "center" } justify={ "center" }>
				<Spinner size={ "xl" } appearance={ "primary" }/>
			</Flex>
		);
	}

	return (
		<litGameContext.Provider value={ ctx }>
			{ props.children }
		</litGameContext.Provider>
	);
}