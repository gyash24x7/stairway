import { createInput, runGame, testClock } from "@tests/helpers/runner.ts";
import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { coup } from "@/games/coup/server/engine.ts";
import { CoupConfig } from "@/games/coup/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );
const seats = [ "a", "b", "c" ].map( player );

const bot = ( id: ReturnType<typeof player> ) =>
	PlayerInfo.make( { id, name: `bot ${ id }`, avatar: "avatar", isBot: true } );

const config = () => CoupConfig.make( {
	playerCount: 3,
	autoStart: false,
	moveTimeoutMillis: 60_000,
	interactionTimeoutMillis: 15_000
} );

test( "how long do bot games run", () => {
	const lengths: Array<number> = [];
	const unfinished: Array<unknown> = [];

	for ( let attempt = 0; attempt < 300; attempt++ ) {
		const clock = testClock();

		const { result } = runGame(
			coup,
			engine => Effect.gen( function* () {
				yield* engine.initialize( createInput( config() ) );
				yield* Effect.forEach( seats, id => engine.join( bot( id ) ) );
				yield* engine.start( seats[ 0 ]! );

				for ( let step = 0; step < 5_000; step++ ) {
					const view = yield* engine.getView();
					if ( view.status === "COMPLETED" ) {
						return { steps: step, turn: view.context.turn };
					}

					clock.advance( 30_000 );
					yield* engine.alarm();
				}

				const view = yield* engine.getView();
				return {
					steps: -1,
					turn: view.context.turn,
					frames: view.context.interactions.map( f => f.kind ),
					seatStatus: view.context.seats,
					players: view.view.playerData,
					pending: view.view.pending,
					tail: view.view.log.slice( -8 )
				};
			} ),
			{ now: clock.now }
		);

		if ( result.steps === -1 ) {
			unfinished.push( result );
		} else {
			lengths.push( result.steps );
		}
	}

	lengths.sort( ( l, r ) => l - r );
	console.log( "finished:", lengths.length, "unfinished:", unfinished.length );
	console.log( "steps min/median/max:", lengths[ 0 ], lengths[ Math.floor( lengths.length / 2 ) ], lengths.at( -1 ) );

	if ( unfinished.length > 0 ) {
		console.log( "UNFINISHED:", JSON.stringify( unfinished[ 0 ], null, 2 ) );
	}

	expect( unfinished ).toHaveLength( 0 );
} );
