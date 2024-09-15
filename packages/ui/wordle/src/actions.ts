"use server";

import { getAuthToken } from "@main/ui";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import type { Router } from "@wordle/api";
import { z } from "zod";
import { createServerAction } from "zsa";

const client = createTRPCClient<Router>( {
	links: [
		httpBatchLink( {
			url: "http://localhost:8000/api/wordle",
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
	.input( z.object( { wordCount: z.number().optional(), wordLength: z.number().optional() } ) )
	.handler( ( { input } ) => client.createGame.mutate( input ).catch( trpcErrorHandler ) );

export const makeGuessAction = createServerAction()
	.input( z.object( { guess: z.string(), gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.makeGuess.mutate( input ).catch( trpcErrorHandler ) );

export const getGameAction = createServerAction()
	.input( z.object( { gameId: z.string().cuid2() } ) )
	.handler( ( { input } ) => client.getGame.query( input ).catch( trpcErrorHandler ) );