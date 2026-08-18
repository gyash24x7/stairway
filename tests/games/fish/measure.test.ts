import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { fish } from "@/games/fish/server/engine.ts";
import { asksOf, buildConfig } from "@/games/fish/server/utils.ts";
import { claimsOf } from "@/games/fish/shared/utils.ts";
import { GameCode, GameId, PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { TestHost } from "@tests/helpers/host.ts";

import type { BookType, PlayerCount } from "@/games/fish/shared/schema.ts";
import type { UserId } from "@/auth/shared/schema.ts";

const play = ( run: number, count: PlayerCount, type: BookType ) => {
	const now = () => Date.now() + 24 * 60 * 60 * 1000;

	const program = Effect.gen( function* () {
		const engine = yield* fish;
		const players = Array.from( { length: count }, ( _, i ) => PlayerId.make( `p${ i }` ) );

		yield* engine.initialize( {
			id: GameId.make( `game-${ run }` ),
			code: GameCode.make( "CODE" ),
			creator: players[ 0 ] as UserId,
			config: buildConfig( count, type, 2 )
		} );

		for ( const id of players ) {
			yield* engine.join(
				PlayerInfo.make( { id, name: `p ${ id }`, avatar: "a", isBot: true } )
			);
		}

		yield* engine.start( players[ 0 ]! );

		for ( let i = 0; i < 3000; i++ ) {
			const view = yield* engine.getState();
			if ( view.status === "COMPLETED" ) {
				break;
			}
			yield* engine.alarm();
		}

		const view = yield* engine.getState();
		const asks = asksOf( view.view );
		const claims = claimsOf( view.view );

		return {
			asks: asks.length,
			hits: asks.filter( a => a.success ).length,
			claims: claims.length,
			donated: claims.filter( c => !c.success ).length,
			transfers: view.view.moves.filter( m => m._tag === "fish/Transfer" ).length,
			completed: view.status === "COMPLETED"
		};
	} ).pipe( Effect.provide( TestHost( { now } ) ) );

	return Effect.runSync( program );
};

describe( "measured behaviour", () => {
	test( "self-play statistics", () => {
		const runs = Array.from( { length: 5 } ).flatMap( ( _, run ) => [
			{ variant: "NORMAL", ...play( run, 4, "NORMAL" ) },
			{ variant: "CANADIAN", ...play( run + 100, 6, "CANADIAN" ) }
		] );

		for ( const variant of [ "NORMAL", "CANADIAN" ] ) {
			const rows = runs.filter( row => row.variant === variant );
			const sum = ( pick: ( row: typeof rows[ number ] ) => number ) =>
				rows.reduce( ( total, row ) => total + pick( row ), 0 );

			console.log( variant, {
				games: rows.length,
				completed: rows.filter( row => row.completed ).length,
				asksPerGame: ( sum( r => r.asks ) / rows.length ).toFixed( 1 ),
				hitRate: ( sum( r => r.hits ) / sum( r => r.asks ) * 100 ).toFixed( 1 ) + "%",
				donatedBooks: sum( r => r.donated ),
				transfersPerGame: ( sum( r => r.transfers ) / rows.length ).toFixed( 1 )
			} );
		}

		expect( runs.every( row => row.completed ) ).toBe( true );
	}, 120_000 );
} );
