import { client } from "@stairway/clients/wordle";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { GameCompleted, GameInProgress } from "@wordle/components";
import { useGameStore, useIsGameCompleted } from "@wordle/store";

export const Route = createFileRoute( "/wordle/$gameId" )( {
	beforeLoad: ( { context } ) => {
		if ( !context.authInfo ) {
			throw redirect( { to: "/" } );
		}
	},
	loader: async ( { params: { gameId } } ) => {
		const game = await client.getGame.query( { gameId } );
		useGameStore.setState( state => ( { ...state, game } ) );
		return game;
	},
	component: () => {
		const isGameCompleted = useIsGameCompleted();

		return (
			<div className={ `flex flex-col items-center mb-20` }>
				<h1 className={ "font-fjalla text-4xl my-3" }>WORDLE</h1>
				{ isGameCompleted ? <GameCompleted/> : <GameInProgress/> }
			</div>
		);
	}
} );
