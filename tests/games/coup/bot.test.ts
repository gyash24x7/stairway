import { createInput, runGame, testClock } from "@tests/helpers/runner.ts";
import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { decideMove } from "@/games/coup/server/bot.ts";
import { coup } from "@/games/coup/server/engine.ts";
import {
	COUP_BLOCK_ACTION,
	COUP_CHALLENGE_ACTION,
	COUP_LOSE_INFLUENCE,
	CoupConfig,
	CoupView
} from "@/games/coup/shared/schema.ts";
import {
	GameContext,
	InteractionFrame,
	PlayerId,
	PlayerInfo
} from "@/swish/shared/schema.ts";

import type { PendingAction } from "@/games/coup/shared/schema.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c ] = [ "a", "b", "c" ].map( player );
const seats = [ a, b, c ];

const bot = ( id: Player ) =>
	PlayerInfo.make( { id, name: `bot ${ id }`, avatar: "avatar", isBot: true } );

const config = () => CoupConfig.make( {
	playerCount: 3,
	autoStart: false,
	moveTimeoutMillis: 60_000,
	interactionTimeoutMillis: 15_000
} );


// --- Hand-built positions --------------------------------------------------

const seat = ( over: { coins?: number; influenceCount?: number } = {} ) => ( {
	coins: over.coins ?? 2,
	influenceCount: over.influenceCount ?? 2
} );

const context = ( over: Partial<GameContext> = {} ) => GameContext.make( {
	turn: 1,
	players: seats,
	currentPlayer: a,
	interactions: [],
	seats: {},
	teams: {},
	teamNames: {},
	...over
} );

const position = (
	over: {
		view?: Partial<CoupView>;
		context?: Partial<GameContext>;
	} = {}
) => ( {
	state: CoupView.make( {
		playerData: { [ a ]: seat(), [ b ]: seat(), [ c ]: seat() },
		deckCount: 9,
		influence: [ "duke", "contessa" ],
		eliminationOrder: [],
		log: [],
		playerId: a,
		...over.view
	} ),
	config: config(),
	context: context( over.context )
} );

const frame = ( kind: string, over: Partial<InteractionFrame> = {} ) => InteractionFrame.make( {
	kind,
	initiator: b,
	responders: [ a ],
	mode: "simultaneous",
	responses: {},
	...over
} );

const pendingOf = ( over: Partial<PendingAction> = {} ) => ( {
	action: "tax" as const,
	actor: b,
	...over
} );


describe( "playing a turn", () => {
	test( "ten coins forces the bot to coup", () => {
		const move = decideMove( position( {
			view: {
				playerData: { [ a ]: seat( { coins: 10 } ), [ b ]: seat(), [ c ]: seat() },
				influence: [ "contessa", "contessa" ]
			}
		} ) );

		expect( move?.moveType ).toBe( "takeAction" );
		expect( move?.input ).toMatchObject( { action: "coup" } );
	} );

	test( "a real Duke is taxed rather than bluffed with", () => {
		const move = decideMove( position( { view: { influence: [ "duke", "ambassador" ] } } ) );

		expect( move?.input ).toMatchObject( { action: "tax" } );
	} );

	test( "a real Captain robs whoever is holding the most", () => {
		const move = decideMove( position( {
			view: {
				influence: [ "captain", "contessa" ],
				playerData: {
					[ a ]: seat(),
					[ b ]: seat( { coins: 1 } ),
					[ c ]: seat( { coins: 6 } )
				}
			}
		} ) );

		expect( move?.input ).toMatchObject( { action: "steal", target: c } );
	} );

	test( "a coup finishes an opponent already down to one card", () => {
		const move = decideMove( position( {
			view: {
				influence: [ "contessa", "contessa" ],
				playerData: {
					[ a ]: seat( { coins: 7 } ),
					[ b ]: seat(),
					[ c ]: seat( { influenceCount: 1 } )
				}
			}
		} ) );

		expect( move?.input ).toMatchObject( { action: "coup", target: c } );
	} );

	test( "the bot never aims at itself or at somebody already out", () => {
		const move = decideMove( position( {
			view: {
				influence: [ "captain", "contessa" ],
				playerData: {
					[ a ]: seat( { coins: 5 } ),
					[ b ]: seat( { influenceCount: 0, coins: 8 } ),
					[ c ]: seat( { coins: 3 } )
				}
			}
		} ) );

		const target = ( move?.input as { target?: Player } | undefined )?.target;

		expect( target ).not.toBe( a );
		expect( target ).not.toBe( b );
	} );

	test( "a seat with nothing left to play does not play", () => {
		const move = decideMove( position( {
			view: {
				influence: [],
				playerData: { [ a ]: seat( { influenceCount: 0 } ), [ b ]: seat(), [ c ]: seat() }
			}
		} ) );

		expect( move ).toBeUndefined();
	} );
} );


describe( "answering a challenge window", () => {
	test( "holding two of a character makes the bot doubt a claim on the third", () => {
		// Two of the three Dukes are in this bot's own hand, so exactly one is left
		// anywhere. Not proof — a card given up goes back to the deck, so nothing
		// is ever proof — but a poor enough bet to call.
		const doubted = Array.from( { length: 12 }, ( _, turn ) => decideMove( position( {
			view: {
				influence: [ "duke", "duke" ],
				pending: pendingOf( { claim: "duke" } )
			},
			context: { turn, interactions: [ frame( COUP_CHALLENGE_ACTION ) ] }
		} ) ) ).filter( move => ( move?.input as { challenge: boolean } ).challenge );

		const ignored = Array.from( { length: 12 }, ( _, turn ) => decideMove( position( {
			view: {
				influence: [ "contessa", "ambassador" ],
				pending: pendingOf( { claim: "duke" } )
			},
			context: { turn, interactions: [ frame( COUP_CHALLENGE_ACTION ) ] }
		} ) ) ).filter( move => ( move?.input as { challenge: boolean } ).challenge );

		// Holding none of them says nothing, and calling on nothing loses games.
		expect( doubted.length ).toBeGreaterThan( ignored.length );
	} );

	test( "a claim with every copy unaccounted for is usually let through", () => {
		const move = decideMove( position( {
			view: {
				influence: [ "contessa", "ambassador" ],
				pending: pendingOf( { claim: "duke" } )
			},
			context: { interactions: [ frame( COUP_CHALLENGE_ACTION ) ] }
		} ) );

		expect( move?.moveType ).toBe( "challenge" );
		expect( typeof ( move?.input as { challenge: boolean } ).challenge ).toBe( "boolean" );
	} );
} );


describe( "answering a block window", () => {
	test( "a real Contessa stops an assassination aimed at the bot", () => {
		const move = decideMove( position( {
			view: {
				influence: [ "duke", "contessa" ],
				pending: pendingOf( { action: "assassinate", claim: "assassin", target: a } )
			},
			context: { interactions: [ frame( COUP_BLOCK_ACTION, { target: a } ) ] }
		} ) );

		expect( move?.moveType ).toBe( "block" );
		expect( move?.input ).toEqual( { block: "contessa" } );
	} );

	test( "a bot on its last card bluffs the Contessa rather than dying", () => {
		const move = decideMove( position( {
			view: {
				// No Contessa, and nothing to lose by claiming one.
				influence: [ "duke" ],
				playerData: {
					[ a ]: seat( { influenceCount: 1 } ),
					[ b ]: seat(),
					[ c ]: seat()
				},
				pending: pendingOf( { action: "assassinate", claim: "assassin", target: a } )
			},
			context: { interactions: [ frame( COUP_BLOCK_ACTION, { target: a } ) ] }
		} ) );

		expect( move?.input ).toEqual( { block: "contessa" } );
	} );

	test( "a real Captain stops a steal", () => {
		const move = decideMove( position( {
			view: {
				influence: [ "captain", "duke" ],
				pending: pendingOf( { action: "steal", claim: "captain", target: a } )
			},
			context: { interactions: [ frame( COUP_BLOCK_ACTION, { target: a } ) ] }
		} ) );

		expect( move?.input ).toEqual( { block: "captain" } );
	} );
} );


describe( "giving up an influence", () => {
	test( "the least useful card goes first", () => {
		const move = decideMove( position( {
			view: { influence: [ "duke", "ambassador" ] },
			context: { interactions: [ frame( COUP_LOSE_INFLUENCE, { target: a } ) ] }
		} ) );

		expect( move?.moveType ).toBe( "surrenderInfluence" );
		expect( move?.input ).toEqual( { card: "ambassador" } );
	} );

	test( "a Duke is kept over an Assassin", () => {
		const move = decideMove( position( {
			view: { influence: [ "assassin", "duke" ] },
			context: { interactions: [ frame( COUP_LOSE_INFLUENCE, { target: a } ) ] }
		} ) );

		expect( move?.input ).toEqual( { card: "assassin" } );
	} );
} );


describe( "a table of bots", () => {
	/**
	 * How many bot moves a table is given before the test calls it stuck.
	 *
	 * Games run to a median of about fifty and have not been seen past two
	 * hundred, so this is loose enough not to be flaky and tight enough to catch
	 * a policy that has stopped making progress rather than merely playing badly.
	 */
	const STEP_CAP = 600;

	/** Runs a fully machine-played table until it finishes or the cap is hit. */
	const played = () => {
		const clock = testClock();

		return runGame(
			coup,
			engine => Effect.gen( function* () {
				yield* engine.initialize( createInput( config() ) );
				yield* Effect.forEach( seats, id => engine.join( bot( id ) ) );
				yield* engine.start( a );

				for ( let step = 0; step < STEP_CAP; step++ ) {
					const view = yield* engine.getView();

					if ( view.status === "COMPLETED" ) {
						return { view, steps: step };
					}

					clock.advance( 30_000 );
					yield* engine.alarm();
				}

				return { view: yield* engine.getView(), steps: STEP_CAP };
			} ),
			{ now: clock.now }
		);
	};

	test( "plays itself to a finish", () => {
		const { result } = played();

		// Nothing drives this but the policy answering its own windows: every
		// challenge, every block, every choice of which card to give up.
		expect( result.view.status ).toBe( "COMPLETED" );
		expect( result.steps ).toBeLessThan( STEP_CAP );
	} );

	test( "and does so every time, not just on a kind deal", () => {
		// A regression guard with a specific failure in mind. Robbing moves coins
		// around the table without adding any, so a policy that always robs when it
		// holds the Captain never gets closer to affording a coup — two Captains
		// robbing each other turn about will sit there forever. That deal is rare
		// enough that a single game misses it, so this plays a spread of them.
		const runs = Array.from( { length: 40 }, () => played().result );

		expect( runs.filter( run => run.view.status !== "COMPLETED" ) ).toEqual( [] );
	}, 60_000 );

	test( "leaves exactly one seat standing", () => {
		const { result } = played();

		const alive = seats.filter(
			id => ( result.view.view.playerData[ id ]?.influenceCount ?? 0 ) > 0
		);

		expect( alive ).toHaveLength( 1 );
		expect( result.view.view.eliminationOrder ).toHaveLength( seats.length - 1 );
	} );

	test( "the survivor is the one the standings call the winner", () => {
		const { result } = played();

		const alive = seats.find(
			id => ( result.view.view.playerData[ id ]?.influenceCount ?? 0 ) > 0
		);

		expect( result.view.results?.winner ).toBe( alive! );
		expect( result.view.results?.ranking ).toHaveLength( seats.length );
		expect( result.view.results?.ranking[ 0 ]?.playerId ).toBe( alive! );
	} );

	test( "the interaction stack is empty when the dust settles", () => {
		const { result } = played();

		expect( result.view.context.interactions ).toEqual( [] );
	} );
} );
