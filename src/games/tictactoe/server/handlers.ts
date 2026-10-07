import * as Effect from "effect/Effect";

import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { AuthContext } from "@/auth/contract";
import { TicTacToeApi } from "@/games/tictactoe/contract";
import { TicTacToeEngine } from "@/games/tictactoe/server/engine";
import { withAuth } from "@/swish/utils";


export const TicTacToeApiLive = HttpApiBuilder.group(
	TicTacToeApi,
	"tictactoe",
	Effect.fn( function* ( handlers ) {
		const engine = yield* TicTacToeEngine;
		return handlers
			.handle( "createGame", ( { payload } ) => withAuth( engine.createGame( payload ) ) )
			.handle( "joinGame", ( { params } ) => withAuth( engine.joinGame( params ) ) )
			.handle( "spectate", ( { params } ) => withAuth( engine.spectate( params ) ) )
			.handle( "addBots", ( { params } ) => withAuth( engine.addBots( params ) ) )
			.handle( "startGame", ( { params } ) => withAuth( engine.startGame( params ) ) )
			.handle( "undo", ( { params } ) => withAuth( engine.undo( params ) ) )
			.handle( "redo", ( { params } ) => withAuth( engine.redo( params ) ) )
			.handle( "autoPlay", args => withAuth( engine.autoPlay( args.params, args.payload ) ) )
			.handle( "rematch", args => withAuth( engine.rematch( args.params, args.payload ) ) )
			.handle( "getView", ( { params } ) => withAuth( engine.getView( params ) ) )
			.handle( "hint", ( { params } ) => withAuth( engine.hint( params ) ) )
			.handle( "subscribe", args => Effect.map( AuthContext, engine.subscribe( args.params ) ) )
			.handle( "place", args => withAuth(
				engine.submitMove( "place", args.params, args.payload ) )
			);
	} )
);
