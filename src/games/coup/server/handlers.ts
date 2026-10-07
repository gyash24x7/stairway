import * as Effect from "effect/Effect";

import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { AuthContext } from "@/auth/contract";
import { CoupApi } from "@/games/coup/contract";
import { CoupEngine } from "@/games/coup/server/engine";
import { withAuth } from "@/swish/utils";


export const CoupApiLive = HttpApiBuilder.group(
	CoupApi,
	"coup",
	Effect.fn( function* ( handlers ) {
		const engine = yield* CoupEngine;
		return handlers
			.handle( "createGame", ( { payload } ) => withAuth( engine.createGame( payload ) ) )
			.handle( "joinGame", ( { params } ) => withAuth( engine.joinGame( params ) ) )
			.handle( "spectate", ( { params } ) => withAuth( engine.spectate( params ) ) )
			.handle( "addBots", ( { params } ) => withAuth( engine.addBots( params ) ) )
			.handle( "startGame", ( { params } ) => withAuth( engine.startGame( params ) ) )
			.handle( "autoPlay", args => withAuth( engine.autoPlay( args.params, args.payload ) ) )
			.handle( "rematch", args => withAuth( engine.rematch( args.params, args.payload ) ) )
			.handle( "getView", ( { params } ) => withAuth( engine.getView( params ) ) )
			.handle( "hint", ( { params } ) => withAuth( engine.hint( params ) ) )
			.handle( "subscribe", args => Effect.map( AuthContext, engine.subscribe( args.params ) ) )
			.handle( "pass", args => withAuth( engine.pass( args.params, args.payload ) ) )
			.handle( "income", args => withAuth(
				engine.submitMove( "income", args.params, args.payload )
			) )
			.handle( "foreignAid", args => withAuth(
				engine.submitMove( "foreignAid", args.params, args.payload )
			) )
			.handle( "tax", args => withAuth(
				engine.submitMove( "tax", args.params, args.payload )
			) )
			.handle( "assassinate", args => withAuth(
				engine.submitMove( "assassinate", args.params, args.payload )
			) )
			.handle( "steal", args => withAuth(
				engine.submitMove( "steal", args.params, args.payload )
			) )
			.handle( "exchange", args => withAuth(
				engine.submitMove( "exchange", args.params, args.payload )
			) )
			.handle( "blockForeignAid", args => withAuth(
				engine.submitMove( "blockForeignAid", args.params, args.payload )
			) )
			.handle( "blockSteal", args => withAuth(
				engine.submitMove( "blockSteal", args.params, args.payload )
			) )
			.handle( "blockAssassination", args => withAuth(
				engine.submitMove( "blockAssassination", args.params, args.payload )
			) )
			.handle( "challenge", args => withAuth(
				engine.submitMove( "challenge", args.params, args.payload )
			) )
			.handle( "exchangeReturn", args => withAuth(
				engine.submitMove( "exchangeReturn", args.params, args.payload )
			) )
			.handle( "coup", args => withAuth(
				engine.submitMove( "coup", args.params, args.payload )
			) )
			.handle( "reveal", args => withAuth(
				engine.submitMove( "reveal", args.params, args.payload )
			) );
	} )
);
