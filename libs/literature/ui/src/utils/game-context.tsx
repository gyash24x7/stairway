import { EnhancedLitGame, IEnhancedLitGame } from "@s2h/literature/utils";
import { Flex, Spinner } from "@s2h/ui";
import React, { createContext, ReactNode, useContext, useState } from "react";
import { useParams } from "react-router-dom";
import { useMount } from "react-use";
import { io } from "socket.io-client";
import { useAuth } from "./auth";
import { trpc } from "./trpc";

const litGameContext = createContext<EnhancedLitGame>( null! );

export const useGame = () => useContext( litGameContext );

export function GameProvider( props: { children: ReactNode } ) {
	const { user } = useAuth();
	const [ ctx, setCtx ] = useState<EnhancedLitGame>();
	const params = useParams<{ gameId: string }>();

	const { isLoading } = trpc.getGame.useQuery( { gameId: params.gameId! }, {
		onSuccess( data ) {
			const game = new EnhancedLitGame( data );
			game.loggedInUserId = user?.id;
			setCtx( game );
		}
	} );

	useMount( () => {
		const socket = io( "http://localhost:8000/literature" );
		socket.on( "welcome", ( data ) => {
			console.log( data );
		} );

		socket.on( params.gameId!, ( data: IEnhancedLitGame ) => {
			const game = new EnhancedLitGame( data );
			game.loggedInUserId = user?.id;
			setCtx( game );
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