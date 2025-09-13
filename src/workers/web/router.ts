import { contract as auth } from "@/workers/auth/contract";
import { contract as callbreak } from "@/workers/callbreak/contract";
import { contract as fish } from "@/workers/fish/contract";
import { createSession, type Session } from "@/workers/web/session";
import { contract as wordle } from "@/workers/wordle/contract";
import { implement, ORPCError } from "@orpc/server";
import { deleteCookie, setCookie, sign } from "@orpc/server/helpers";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";

const expirationTtl = 7 * 24 * 60 * 60; // 7 days
const cookieOptions = {
	maxAge: expirationTtl,
	path: "/",
	httpOnly: true,
	secure: process.env.NODE_ENV === "production"
};

type Ctx = ResponseHeadersPluginContext & { env: WebWorkerEnv; session?: Session };
const os = implement( { auth, wordle, fish, callbreak } ).$context<Ctx>();

export const router = os.router( {
	auth: {
		authInfo: os.auth.authInfo.handler( ( { context } ) => context.session?.authInfo ?? null ),

		logout: os.auth.logout.handler( async ( { context } ) => {
			if ( !context.session ) {
				throw new ORPCError( "FORBIDDEN" );
			}

			await context.env.SESSION_KV.delete( context.session.id );
			deleteCookie( context.resHeaders, "auth_session" );
		} ),

		userExists: os.auth.userExists.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.AUTH_WORKER.userExists( input )
		) ),

		getRegistrationOptions: os.auth.getRegistrationOptions.handler( ( { input, context } ) => {
			return handleRPCResponse( () => context.env.AUTH_WORKER.getRegistrationOptions( input ) );
		} ),

		getLoginOptions: os.auth.getLoginOptions.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.AUTH_WORKER.getLoginOptions( input )
		) ),

		verifyRegistration: os.auth.verifyRegistration.handler( async ( { input, context } ) => {
			const { data, error } = await context.env.AUTH_WORKER.verifyRegistration( input );
			if ( error || !data ) {
				throw new ORPCError( "BAD_REQUEST", { message: error ?? "Internal Server Error" } );
			}

			const session = await createSession( data );
			await context.env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } );
			setCookie(
				context.resHeaders,
				"auth_session",
				await sign( session.id, context.env.AUTH_SECRET_KEY ),
				cookieOptions
			);
		} ),

		verifyLogin: os.auth.verifyLogin.handler( async ( { input, context } ) => {
			const { data, error } = await context.env.AUTH_WORKER.verifyLogin( input );
			if ( error || !data ) {
				throw new ORPCError( "BAD_REQUEST", { message: error ?? "Internal Server Error" } );
			}

			const session = await createSession( data );
			await context.env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } );
			setCookie(
				context.resHeaders,
				"auth_session",
				await sign( session.id, context.env.AUTH_SECRET_KEY ),
				cookieOptions
			);
		} )
	},

	wordle: {
		createGame: os.wordle.createGame.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.WORDLE_WORKER.createGame( input, context.session?.authInfo! )
		) ),
		getGameData: os.wordle.getGameData.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.WORDLE_WORKER.getGameData( input, context.session?.authInfo! )
		) ),
		makeGuess: os.wordle.makeGuess.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.WORDLE_WORKER.makeGuess( input, context.session?.authInfo! )
		) ),
		getWords: os.wordle.getWords.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.WORDLE_WORKER.getWords( input, context.session?.authInfo! )
		) )
	},

	callbreak: {
		createGame: os.callbreak.createGame.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.CALLBREAK_WORKER.createGame( input, context.session?.authInfo! )
		) ),
		joinGame: os.callbreak.joinGame.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.CALLBREAK_WORKER.joinGame( input, context.session?.authInfo! )
		) ),
		getGameData: os.callbreak.getGameData.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.CALLBREAK_WORKER.getGameData( input, context.session?.authInfo! )
		) ),
		declareDealWins: os.callbreak.declareDealWins.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.CALLBREAK_WORKER.declareDealWins( input, context.session?.authInfo! )
		) ),
		playCard: os.callbreak.playCard.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.CALLBREAK_WORKER.playCard( input, context.session?.authInfo! )
		) )
	},

	fish: {
		createGame: os.fish.createGame.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.createGame( input, context.session?.authInfo! )
		) ),
		getGameData: os.fish.getGameData.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.getGameData( input, context.session?.authInfo! )
		) ),
		joinGame: os.fish.joinGame.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.joinGame( input, context.session?.authInfo! )
		) ),
		createTeams: os.fish.createTeams.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.createTeams( input, context.session?.authInfo! )
		) ),
		startGame: os.fish.startGame.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.startGame( input, context.session?.authInfo! )
		) ),
		askCard: os.fish.askCard.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.askCard( input, context.session?.authInfo! )
		) ),
		claimBook: os.fish.claimBook.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.claimBook( input, context.session?.authInfo! )
		) ),
		transferTurn: os.fish.transferTurn.handler( ( { input, context } ) => handleRPCResponse(
			() => context.env.FISH_WORKER.transferTurn( input, context.session?.authInfo! )
		) )
	}
} );

async function handleRPCResponse<T>(
	fetcher: () => Promise<DataResponse<T>>
) {
	const { error, data } = await fetcher();
	if ( error || !data ) {
		console.log( error );
		throw new ORPCError( "BAD_REQUEST", { message: error } );
	}
	return data;
}