import * as Effect from "effect/Effect";

import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { AuthContext } from "@/auth/contract";
import { FishApi } from "@/games/fish/contract";
import { FishEngine } from "@/games/fish/server/engine";
import { withAuth } from "@/swish/utils";


export const FishApiLive = HttpApiBuilder.group(
	FishApi,
	"fish",
	Effect.fn( function* ( handlers ) {
		const engine = yield* FishEngine;
		return handlers
			.handle( "createGame", ( { payload } ) => withAuth( engine.createGame( payload ) ) )
			.handle( "joinGame", ( { params } ) => withAuth( engine.joinGame( params ) ) )
			.handle( "spectate", ( { params } ) => withAuth( engine.spectate( params ) ) )
			.handle( "addBots", ( { params } ) => withAuth( engine.addBots( params ) ) )
			.handle( "joinTeam", args => withAuth( engine.joinTeam( args.params, args.payload ) ) )
			.handle( "nameTeam", args => withAuth( engine.nameTeam( args.params, args.payload ) ) )
			.handle( "leaveTeam", ( { params } ) => withAuth( engine.leaveTeam( params ) ) )
			.handle( "startGame", ( { params } ) => withAuth( engine.startGame( params ) ) )
			.handle( "undo", ( { params } ) => withAuth( engine.undo( params ) ) )
			.handle( "redo", ( { params } ) => withAuth( engine.redo( params ) ) )
			.handle( "autoPlay", args => withAuth( engine.autoPlay( args.params, args.payload ) ) )
			.handle( "rematch", args => withAuth( engine.rematch( args.params, args.payload ) ) )
			.handle( "getView", ( { params } ) => withAuth( engine.getView( params ) ) )
			.handle( "hint", ( { params } ) => withAuth( engine.hint( params ) ) )
			.handle( "subscribe", args => Effect.map( AuthContext, engine.subscribe( args.params ) ) )
			.handle( "askCard", args => withAuth(
				engine.submitMove( "askCard", args.params, args.payload )
			) )
			.handle( "claimBook", args => withAuth(
				engine.submitMove( "claimBook", args.params, args.payload )
			) )
			.handle( "transferTurn", args => withAuth(
				engine.submitMove( "transferTurn", args.params, args.payload )
			) );
	} )
);
