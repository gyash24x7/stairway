import * as Effect from "effect/Effect";

import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { AuthContext } from "@/auth/contract";
import { SplendorApi } from "@/games/splendor/contract";
import { SplendorEngine } from "@/games/splendor/server/engine";
import { withAuth } from "@/swish/utils";


export const SplendorApiLive = HttpApiBuilder.group(
	SplendorApi,
	"splendor",
	Effect.fn( function* ( handlers ) {
		const engine = yield* SplendorEngine;
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
			.handle( "pickTokens", args => withAuth(
				engine.submitMove( "pickTokens", args.params, args.payload )
			) )
			.handle( "reserveCard", args => withAuth(
				engine.submitMove( "reserveCard", args.params, args.payload )
			) )
			.handle( "purchaseCard", args => withAuth(
				engine.submitMove( "purchaseCard", args.params, args.payload )
			) )
			.handle( "claimNoble", args => withAuth(
				engine.submitMove( "claimNoble", args.params, args.payload )
			) )
			.handle( "passTurn", args => withAuth(
				engine.submitMove( "passTurn", args.params, args.payload )
			) );
	} )
);
