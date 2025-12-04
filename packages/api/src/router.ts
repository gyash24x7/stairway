import { implement, ORPCError, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { RequestHeadersPluginContext, ResponseHeadersPluginContext } from "@orpc/server/plugins";
import { RequestHeadersPlugin, ResponseHeadersPlugin, SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import type { Session } from "@s2h/auth/types";
import callbreak from "@s2h/callbreak/contract";
import type { CallbreakService } from "@s2h/callbreak/service";
import fish from "@s2h/fish/contract";
import type { FishService } from "@s2h/fish/service";
import wordle from "@s2h/wordle/contract";
import type { WordleService } from "@s2h/wordle/service";
import type { SessionService } from "./sessions.ts";

export type Ctx = RequestHeadersPluginContext & ResponseHeadersPluginContext & {
	session?: Session;
	services: {
		session: SessionService;
		callbreak: CallbreakService;
		fish: FishService;
		wordle: WordleService;
	}
}

const os = implement( { callbreak, fish, wordle } ).$context<Ctx>();

function withAuth() {
	return os.use( ( { context, next } ) => {
		if ( !context.session?.authInfo ) {
			throw new ORPCError( "UNAUTHORIZED" );
		}
		return next( { context: { session: context.session } } );
	} );
}

const router = os.router( {
	callbreak: {
		createGame: withAuth().callbreak.createGame.handler( ( { input, context } ) => {
			return context.services.callbreak.createGame( input, context.session.authInfo );
		} ),
		joinGame: withAuth().callbreak.joinGame.handler( ( { input, context } ) => {
			return context.services.callbreak.joinGame( input, context.session.authInfo );
		} ),
		getGameData: withAuth().callbreak.getGameData.handler( ( { input, context } ) => {
			return context.services.callbreak.getGameData( input, context.session.authInfo );
		} ),
		declareDealWins: withAuth().callbreak.declareDealWins.handler( async ( { input, context } ) => {
			await context.services.callbreak.declareDealWins( input, context.session.authInfo );
		} ),
		playCard: withAuth().callbreak.playCard.handler( async ( { input, context } ) => {
			await context.services.callbreak.playCard( input, context.session.authInfo );
		} )
	},
	fish: {
		createGame: withAuth().fish.createGame.handler( ( { input, context } ) => {
			return context.services.fish.createGame( input, context.session.authInfo );
		} ),
		joinGame: withAuth().fish.joinGame.handler( ( { input, context } ) => {
			return context.services.fish.joinGame( input, context.session.authInfo );
		} ),
		getGameData: withAuth().fish.getGameData.handler( ( { input, context } ) => {
			return context.services.fish.getGameData( input, context.session.authInfo );
		} ),
		createTeams: withAuth().fish.createTeams.handler( async ( { input, context } ) => {
			await context.services.fish.createTeams( input, context.session.authInfo );
		} ),
		startGame: withAuth().fish.startGame.handler( async ( { input, context } ) => {
			await context.services.fish.startGame( input, context.session.authInfo );
		} ),
		askCard: withAuth().fish.askCard.handler( async ( { input, context } ) => {
			await context.services.fish.handleAskEvent( input, context.session.authInfo );
		} ),
		claimBook: withAuth().fish.claimBook.handler( async ( { input, context } ) => {
			await context.services.fish.handleClaimEvent( input, context.session.authInfo );
		} ),
		transferTurn: withAuth().fish.transferTurn.handler( async ( { input, context } ) => {
			await context.services.fish.handleTransferEvent( input, context.session.authInfo );
		} )
	},
	wordle: {
		createGame: withAuth().wordle.createGame.handler( ( { input, context } ) => {
			return context.services.wordle.createGame( input, context.session.authInfo.id );
		} ),
		getGame: withAuth().wordle.getGame.handler( ( { input, context } ) => {
			return context.services.wordle.getGame( input, context.session.authInfo.id );
		} ),
		getWords: withAuth().wordle.getWords.handler( ( { input, context } ) => {
			return context.services.wordle.getWords( input, context.session.authInfo.id );
		} ),
		makeGuess: withAuth().wordle.makeGuess.handler( ( { input, context } ) => {
			return context.services.wordle.makeGuess( input, context.session.authInfo.id );
		} )
	}
} );

export const handler = new RPCHandler( router, {
	plugins: [
		new SimpleCsrfProtectionHandlerPlugin(),
		new ResponseHeadersPlugin(),
		new RequestHeadersPlugin()
	]
} );

export type ApiClient = RouterClient<typeof router>