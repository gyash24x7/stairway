import { wordle } from "@stairway/clients/wordle";
import { GamePage } from "@wordle/components";
import { useGameStore } from "@wordle/store";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute( "/wordle/$gameId" )( {
	beforeLoad: ( { context } ) => {
		if ( !context.authInfo ) {
			throw redirect( { to: "/" } );
		}
	},
	loader: async ( { params: { gameId }, context } ) => {
		const game = await context.queryClient.ensureQueryData( wordle.getGameOptions( gameId ) );
		useGameStore.setState( { game } );
		return game;
	},
	component: () => {
		return <GamePage/>;
	}
} );
