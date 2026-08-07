import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	detectTeammateSignals,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestTransfers
} from "@/games/fish/server/bot.ts";
import { fish } from "@/games/fish/server/engine.ts";
import type { FishConfig, Team } from "@/games/fish/shared/schema.ts";
import { FishPlayerView } from "@/games/fish/shared/schema.ts";
import { buildConfig, getCardsOfBook } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import { GameCode, GameId } from "@/shared/swish/schema.ts";
import type { PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import { mulberry32 } from "@/shared/utils/rng.ts";
import {
	makeMemory,
	type Memory,
	player,
	run,
	runSilent
} from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

const P1 = player( "p1" );
const P2 = player( "p2" );
const P3 = player( "p3" );
const P4 = player( "p4" );

const BOTS = [ "b1", "b2", "b3", "b4" ].map( id => player( id, true ) );

/** Bot moves stall rather than hang: this caps the self-play driver loop. */
const MAX_TURNS = 500;

/** The fish deal shuffles with the global `Math.random`; pin it for reproducibility. */
const seedGlobalRandom = ( seed: number ) => {
	const original = Math.random;
	Math.random = mulberry32( seed );
	return () => { Math.random = original; };
};

const canadianConfig = () => ( {
	...buildConfig( 4, "CANADIAN", 2 ),
	autoStart: false
} ) as FishConfig;

const normalConfig = () => ( {
	...buildConfig( 4, "NORMAL", 2 ),
	autoStart: false
} ) as FishConfig;

/** initialize → join → start; lands in TEAM_CONFIG with the first seat to act. */
async function bootFish( memory: Memory, config: FishConfig, players: PlayerInfo[] ) {
	const engine = await run( memory, fish );
	await run( memory, engine.initialize( { id: GID, code: CODE, config, seed: "seed" } ) );
	for ( const p of players ) {
		await run( memory, engine.join( p ) );
	}

	await run( memory, engine.start( players[ 0 ]!.id ) );
	return engine;
}

const scheduled = ( memory: Memory ) => memory.scheduler.scheduled.map( s => s.alarm );

// --- Synthetic view fixtures ----------------------------------------------
// The exported heuristics are pure functions over a `FishPlayerView`, so the
// sharpest way to pin their branches is to hand them a view built by hand.

const NO_METRICS = {
	totalAsks: 0,
	cardsGiven: 0,
	cardsTaken: 0,
	totalClaims: 0,
	successfulClaims: 0
};

/** Builds `{ teams, playerData }` for the given team → members split. */
function rosterOf( split: Record<string, PlayerId[]> ) {
	const teams: Record<string, Team> = {};
	const playerData: Record<PlayerId, { teamId: string; metrics: typeof NO_METRICS }> = {};

	for ( const [ name, members ] of Object.entries( split ) ) {
		teams[ name ] = { id: name, name, members, score: 0, booksWon: [] };
		for ( const pid of members ) {
			playerData[ pid ] = { teamId: name, metrics: { ...NO_METRICS } };
		}
	}

	return { teams, playerData };
}

type ViewOverrides = {
	playerId: PlayerId;
	hand: CardId[];
	cardLocations: Record<string, PlayerId[]>;
	cardCounts?: Record<PlayerId, number>;
	askHistory?: Array<{
		success: boolean;
		playerId: PlayerId;
		from: PlayerId;
		cardId: CardId;
		timestamp: number;
	}>;
	split?: Record<string, PlayerId[]>;
};

const TWO_TEAMS = { T1: [ P1.id, P3.id ], T2: [ P2.id, P4.id ] };

/** A `FishPlayerView` with everything irrelevant zeroed out. */
function makeView( over: ViewOverrides ) {
	const { teams, playerData } = rosterOf( over.split ?? TWO_TEAMS );
	const players = Object.keys( playerData ) as PlayerId[];
	const cardCounts = over.cardCounts
		?? Object.fromEntries( players.map( pid => [ pid, 5 ] ) ) as Record<PlayerId, number>;

	return FishPlayerView.make( {
		playerId: over.playerId,
		hand: over.hand,
		teams,
		playerData,
		cardCounts,
		cardLocations: over.cardLocations,
		askHistory: over.askHistory ?? [],
		claimHistory: [],
		transferHistory: []
	} );
}

const ACES = [ "AC", "AD", "AH", "AS" ] as CardId[];

// ===========================================================================
describe( "fish — bot self-play", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 101 ); } );
	afterEach( () => { restore(); } );

	test( "a bot fills in the teams during TEAM_CONFIG", async () => {
		const engine = await bootFish( memory, canadianConfig(), BOTS );
		expect( scheduled( memory ) ).toContain( "bot" );

		await runSilent( memory, engine.alarm() );

		const state = await run( memory, engine.getState( BOTS[ 0 ]!.id ) );
		const view = state.view as typeof FishPlayerView.Type;
		expect( state.context.phase ).toBe( "PLAY" );
		expect( Object.keys( view.teams ) ).toHaveLength( 2 );
		for ( const team of Object.values( view.teams ) ) {
			expect( team.members ).toHaveLength( 2 );
		}

		// Entering PLAY dealt the hands.
		expect( view.hand ).toHaveLength( 12 );
	} );

	// Three deals, because a bot policy that is legal on one shuffle and illegal on
	// the next is the failure mode worth catching.
	for ( const seed of [ 101, 2027, 55555 ] ) {
		test( `a bot-only CANADIAN game plays itself to completion (deal ${ seed })`, async () => {
			restore();
			restore = seedGlobalRandom( seed );

			const config = canadianConfig();
			const engine = await bootFish( memory, config, BOTS );

			let turns = 0;
			let status = "IN_PROGRESS";
			while ( turns < MAX_TURNS ) {
				const state = await run( memory, engine.getState( BOTS[ 0 ]!.id ) );
				status = state.status;
				if ( status === "COMPLETED" ) {
					break;
				}

				// A stalled game schedules nothing; failing here beats hanging.
				expect( scheduled( memory ) ).toContain( "bot" );

				const before = memory.log.commits.length;
				await runSilent( memory, engine.alarm() );
				// Every move the bot picks must be one the engine accepts.
				expect( memory.log.commits.length ).toBe( before + 1 );
				turns++;
			}

			expect( turns ).toBeLessThan( MAX_TURNS );
			expect( status ).toBe( "COMPLETED" );

			const view = ( await run( memory, engine.getState( BOTS[ 0 ]!.id ) ) )
				.view as typeof FishPlayerView.Type;

			expect( Object.values( view.teams ).flatMap( t => t.booksWon ).sort() )
				.toEqual( [ ...config.books ].sort() );
			expect( view.winningTeam ).toBeDefined();
		// A whole game is hundreds of engine commands, so it needs more than bun's
		// 5s default — it passes alone but tips over under full-suite load.
		}, 30_000 );
	}

	test( "a bot seated mid-game plays a legal move when its alarm fires", async () => {
		const config = normalConfig();
		const bot = player( "bot", true );
		const players = [ P1, bot, P3, P4 ];
		const engine = await bootFish( memory, config, players );

		await run( memory, engine.createTeams( {
			teams: { Red: [ P1.id, P3.id ], Blue: [ bot.id, P4.id ] }
		}, P1 ) );

		// p1 asks the bot for a card the bot cannot have, handing it the turn.
		const view = ( await run( memory, engine.getState( P1.id ) ) )
			.view as typeof FishPlayerView.Type;
		const botHand = ( ( await run( memory, engine.getState( bot.id ) ) )
			.view as typeof FishPlayerView.Type ).hand;

		const book = config.books.find(
			b => getCardsOfBook( b, config.type ).some( c => view.hand.includes( c ) )
		)!;
		const cardId = getCardsOfBook( book, config.type ).find(
			c => !view.hand.includes( c ) && !botHand.includes( c )
		)!;

		await run( memory, engine.askCard( { from: bot.id, cardId }, P1 ) );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).context.currentPlayer )
			.toBe( bot.id );
		expect( scheduled( memory ) ).toContain( "bot" );

		const before = memory.log.commits.length;
		await runSilent( memory, engine.alarm() );

		expect( memory.log.commits.length ).toBe( before + 1 );
		const after = ( await run( memory, engine.getState( bot.id ) ) )
			.view as typeof FishPlayerView.Type;
		// The bot acted — the move landed in one of the three histories.
		expect(
			after.askHistory.length + after.claimHistory.length + after.transferHistory.length
		).toBeGreaterThan( 1 );
	} );
} );

// ===========================================================================
describe( "fish — bot heuristics", () => {
	const config = normalConfig();

	test( "suggestBooks ranks a book the bot half-holds above an unknown one", () => {
		const cardLocations: Record<string, PlayerId[]> = {};
		for ( const card of ACES ) {
			cardLocations[ card ] = [ P1.id, P2.id, P3.id, P4.id ];
		}
		for ( const card of [ "2C", "2D", "2H", "2S" ] as CardId[] ) {
			cardLocations[ card ] = [ P1.id, P2.id, P3.id, P4.id ];
		}

		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD" ] as CardId[],
			cardLocations
		} );

		const books = suggestBooks( view, config );
		expect( books.map( b => b.book ) ).toEqual( [ "ACES", "TWOS" ] );
		expect( books[ 0 ]!.weight ).toBeGreaterThan( books[ 1 ]!.weight );
		// Nothing is pinned down yet, so nothing is claimable.
		expect( books.every( b => !b.isClaimable ) ).toBe( true );
	} );

	test( "suggestBooks marks a fully-located book claimable and with the team", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD" ] as CardId[],
			cardLocations: { AC: [ P1.id ], AD: [ P1.id ], AH: [ P3.id ], AS: [ P3.id ] },
			cardCounts: { [ P1.id ]: 2, [ P2.id ]: 0, [ P3.id ]: 2, [ P4.id ]: 0 }
		} );

		const [ aces ] = suggestBooks( view, config );
		expect( aces!.book ).toBe( "ACES" );
		expect( aces!.isClaimable ).toBe( true );
		expect( aces!.isBookWithTeam ).toBe( true );
	} );

	test( "suggestClaims proposes the exact owners of a fully-located book", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD" ] as CardId[],
			cardLocations: { AC: [ P1.id ], AD: [ P1.id ], AH: [ P3.id ], AS: [ P3.id ] },
			cardCounts: { [ P1.id ]: 2, [ P2.id ]: 0, [ P3.id ]: 2, [ P4.id ]: 0 }
		} );

		const claims = suggestClaims( suggestBooks( view, config ), view, config );
		expect( claims ).toHaveLength( 1 );
		expect( claims[ 0 ]!.book ).toBe( "ACES" );
		expect( claims[ 0 ]!.claim ).toEqual( {
			AC: P1.id, AD: P1.id, AH: P3.id, AS: P3.id
		} );
	} );

	test( "suggestClaims refuses a book an opponent may still hold", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD" ] as CardId[],
			cardLocations: { AC: [ P1.id ], AD: [ P1.id ], AH: [ P2.id ], AS: [ P3.id ] }
		} );

		expect( suggestClaims( suggestBooks( view, config ), view, config ) ).toEqual( [] );
	} );

	test( "suggestAsks only ever proposes opponents, for cards outside the hand", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				AD: [ P2.id, P3.id, P4.id ],
				AH: [ P2.id, P4.id ],
				AS: [ P2.id, P3.id, P4.id ]
			}
		} );

		const asks = suggestAsks( suggestBooks( view, config ), view, config );
		expect( asks.length ).toBeGreaterThan( 0 );
		for ( const ask of asks ) {
			expect( [ P2.id, P4.id ] ).toContain( ask.playerId );
			expect( view.hand ).not.toContain( ask.cardId );
			expect( ACES ).toContain( ask.cardId );
		}
	} );

	test( "suggestAsks skips books the bot holds no card from", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				AD: [ P2.id, P4.id ],
				AH: [ P2.id, P4.id ],
				AS: [ P2.id, P4.id ],
				"2C": [ P2.id, P4.id ],
				"2D": [ P2.id, P4.id ],
				"2H": [ P2.id, P4.id ],
				"2S": [ P2.id, P4.id ]
			}
		} );

		const asks = suggestAsks( suggestBooks( view, config ), view, config );
		expect( asks.length ).toBeGreaterThan( 0 );
		expect( asks.every( a => ACES.includes( a.cardId ) ) ).toBe( true );
	} );

	test( "suggestAsks ignores opponents who have run out of cards", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				AD: [ P2.id, P4.id ],
				AH: [ P2.id, P4.id ],
				AS: [ P2.id, P4.id ]
			},
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 0, [ P3.id ]: 3, [ P4.id ]: 3 }
		} );

		const asks = suggestAsks( suggestBooks( view, config ), view, config );
		expect( asks.length ).toBeGreaterThan( 0 );
		expect( asks.every( a => a.playerId === P4.id ) ).toBe( true );
	} );

	test( "suggestAsks boosts the book the bot is already working", () => {
		const askHistory = [ {
			success: false,
			playerId: P1.id,
			from: P2.id,
			cardId: "AD" as CardId,
			timestamp: 1
		} ];

		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "2C" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				AD: [ P4.id ],
				AH: [ P2.id, P4.id ],
				AS: [ P2.id, P4.id ],
				"2C": [ P1.id ],
				"2D": [ P2.id, P4.id ],
				"2H": [ P2.id, P4.id ],
				"2S": [ P2.id, P4.id ]
			},
			askHistory
		} );

		const asks = suggestAsks( suggestBooks( view, config ), view, config );
		// The last ask was in ACES and an opponent may still hold one, so ACES asks
		// outrank the TWOS asks the bot could equally make.
		expect( ACES ).toContain( asks[ 0 ]!.cardId );
	} );

	test( "suggestTransfers points at the teammate holding known cards", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: { AC: [ P1.id ], AD: [ P3.id ], AH: [ P3.id ], AS: [ P2.id, P4.id ] }
		} );

		const transfers = suggestTransfers( view, config );
		expect( transfers ).toHaveLength( 1 );
		expect( transfers[ 0 ]!.transferTo ).toBe( P3.id );
	} );

	test( "suggestTransfers has nothing to say when no location is known", () => {
		const cardLocations: Record<string, PlayerId[]> = {};
		for ( const card of ACES ) {
			cardLocations[ card ] = [ P1.id, P2.id, P3.id, P4.id ];
		}

		const view = makeView( { playerId: P1.id, hand: [ "AC" ] as CardId[], cardLocations } );
		expect( suggestTransfers( view, config ) ).toEqual( [] );
	} );
} );

// ===========================================================================
describe( "fish — bot signal detection", () => {
	const config = normalConfig();
	const P5 = player( "p5" );
	const P6 = player( "p6" );

	/** Three-a-side, so the bot has two teammates to read a signal between. */
	const THREE_A_SIDE = {
		T1: [ P1.id, P3.id, P5.id ],
		T2: [ P2.id, P4.id, P6.id ]
	};

	const sixHandedLocations = () => {
		const locations: Record<string, PlayerId[]> = {};
		for ( const card of ACES ) {
			locations[ card ] = [ P2.id, P3.id, P4.id, P5.id, P6.id ];
		}

		return locations;
	};

	test( "no teammates means no signals", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: sixHandedLocations(),
			split: { T1: [ P1.id ], T2: [ P2.id ] }
		} );

		expect( detectTeammateSignals( view, config ) ).toEqual( [] );
	} );

	test( "an empty ask history yields no signals", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: sixHandedLocations(),
			split: THREE_A_SIDE
		} );

		expect( detectTeammateSignals( view, config ) ).toEqual( [] );
	} );

	test( "a teammate asking in the book another teammate failed in is a signal", () => {
		// askHistory is newest-first: p5 (newer) asked in ACES right after p3 failed
		// to get AH — so p5 most likely holds AH.
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: sixHandedLocations(),
			split: THREE_A_SIDE,
			askHistory: [
				{ success: true, playerId: P5.id, from: P2.id, cardId: "AS", timestamp: 2 },
				{ success: false, playerId: P3.id, from: P2.id, cardId: "AH", timestamp: 1 }
			] as ViewOverrides["askHistory"]
		} );

		const signals = detectTeammateSignals( view, config );
		expect( signals ).toHaveLength( 1 );
		expect( signals[ 0 ] ).toMatchObject( {
			cardId: "AH",
			likelyHolder: P5.id,
			book: "ACES",
			confidence: 0.7
		} );
	} );

	test( "a successful ask is not a signal", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: sixHandedLocations(),
			split: THREE_A_SIDE,
			askHistory: [
				{ success: true, playerId: P5.id, from: P2.id, cardId: "AS", timestamp: 2 },
				{ success: true, playerId: P3.id, from: P2.id, cardId: "AH", timestamp: 1 }
			] as ViewOverrides["askHistory"]
		} );

		expect( detectTeammateSignals( view, config ) ).toEqual( [] );
	} );

	test( "a follow-up in a different book is not a signal", () => {
		const locations = sixHandedLocations();
		for ( const card of [ "2C", "2D", "2H", "2S" ] as CardId[] ) {
			locations[ card ] = [ P2.id, P3.id, P4.id, P5.id, P6.id ];
		}

		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: locations,
			split: THREE_A_SIDE,
			askHistory: [
				{ success: true, playerId: P5.id, from: P2.id, cardId: "2S", timestamp: 2 },
				{ success: false, playerId: P3.id, from: P2.id, cardId: "AH", timestamp: 1 }
			] as ViewOverrides["askHistory"]
		} );

		expect( detectTeammateSignals( view, config ) ).toEqual( [] );
	} );

	test( "a card the bot holds itself is never signalled", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AH" ] as CardId[],
			cardLocations: sixHandedLocations(),
			split: THREE_A_SIDE,
			askHistory: [
				{ success: true, playerId: P5.id, from: P2.id, cardId: "AS", timestamp: 2 },
				{ success: false, playerId: P3.id, from: P2.id, cardId: "AH", timestamp: 1 }
			] as ViewOverrides["askHistory"]
		} );

		expect( detectTeammateSignals( view, config ) ).toEqual( [] );
	} );

	test( "a signal steers the claim to the teammate it points at", () => {
		const locations = sixHandedLocations();
		locations[ "AC" ] = [ P1.id ];
		locations[ "AD" ] = [ P3.id ];
		locations[ "AS" ] = [ P5.id ];
		// AH stays ambiguous — only the signal can place it.
		locations[ "AH" ] = [ P3.id, P5.id ];

		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: locations,
			split: THREE_A_SIDE,
			askHistory: [
				{ success: true, playerId: P5.id, from: P2.id, cardId: "AS", timestamp: 2 },
				{ success: false, playerId: P3.id, from: P2.id, cardId: "AH", timestamp: 1 }
			] as ViewOverrides["askHistory"]
		} );

		const signals = detectTeammateSignals( view, config );
		const claims = suggestClaims( suggestBooks( view, config, signals ), view, config, signals );

		expect( claims ).toHaveLength( 1 );
		expect( claims[ 0 ]!.claim ).toEqual( {
			AC: P1.id, AD: P3.id, AH: P5.id, AS: P5.id
		} );
	} );

	test( "a signal deprioritises asking opponents for the signalled card", () => {
		const locations = sixHandedLocations();
		locations[ "AC" ] = [ P1.id ];
		locations[ "AH" ] = [ P2.id, P5.id ];
		locations[ "AD" ] = [ P2.id, P5.id ];

		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: locations,
			split: THREE_A_SIDE,
			askHistory: [
				{ success: true, playerId: P5.id, from: P2.id, cardId: "AS", timestamp: 2 },
				{ success: false, playerId: P3.id, from: P2.id, cardId: "AH", timestamp: 1 }
			] as ViewOverrides["askHistory"]
		} );

		const signals = detectTeammateSignals( view, config );
		const asks = suggestAsks( suggestBooks( view, config, signals ), view, config, signals );
		const forSignalled = asks.find( a => a.cardId === "AH" )!;
		const forOther = asks.find( a => a.cardId === "AD" )!;

		expect( forSignalled.weight ).toBeLessThan( forOther.weight );
	} );
} );
