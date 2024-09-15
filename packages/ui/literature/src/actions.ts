"use server";

import { type Router } from "@literature/api";
import { getAuthToken } from "@main/ui";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createServerAction } from "zsa";

const client = createTRPCClient<Router>( {
	links: [
		httpBatchLink( {
			url: "http://localhost:8000/api/literature",
			async headers() {
				const token = await getAuthToken();
				if ( token ) {
					return { Authorization: `Bearer ${ token }` };
				}

				return {};
			}
		} )
	]
} );

const trpcErrorHandler = ( e: TRPCError ) => {
	throw e.message;
};

export const createGameAction = createServerAction()
	.input( z.object( { playerCount: z.number().positive().multipleOf( 2 ).lte( 8 ).optional() } ) )
	.handler( ( { input } ) => client.createGame.mutate( input ).catch( trpcErrorHandler ) );

export const joinGameAction = createServerAction()
	.input( z.object( { code: z.string().length( 6 ) } ) )
	.handler( ( { input } ) => client.joinGame.mutate( input ).catch( trpcErrorHandler ) );

export const getGameAction = createServerAction()
	.input( z.object( { gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.getGameData.query( input ).catch( trpcErrorHandler ) );

export const addBotsAction = createServerAction()
	.input( z.object( { gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.addBots.mutate( input ).catch( trpcErrorHandler ) );

export const createTeamsAction = createServerAction()
	.input( z.object( { data: z.record( z.string().array() ), gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.createTeams.mutate( input ).catch( trpcErrorHandler ) );

export const startGameAction = createServerAction()
	.input( z.object( { gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.startGame.mutate( input ).catch( trpcErrorHandler ) );

export const askCardAction = createServerAction()
	.input( z.object( { from: z.string(), for: z.string(), gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.askCard.mutate( input ).catch( trpcErrorHandler ) );

export const callSetAction = createServerAction()
	.input( z.object( { data: z.record( z.string(), z.string() ), gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.callSet.mutate( input ).catch( trpcErrorHandler ) );

export const transferTurnAction = createServerAction()
	.input( z.object( { transferTo: z.string(), gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.transferTurn.mutate( input ).catch( trpcErrorHandler ) );

export const executeBotMoveAction = createServerAction()
	.input( z.object( { gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.executeBotMove.mutate( input ).catch( trpcErrorHandler ) );