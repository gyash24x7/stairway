import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { fish } from "@/games/fish/server/engine.ts";
import type { Claim, FishConfig, FishSnapshot, Team } from "@/games/fish/shared/schema.ts";
import { FishPlayerView } from "@/games/fish/shared/schema.ts";
import { buildConfig, getCardsOfBook } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import { GameCode, GameId } from "@/shared/swish/schema.ts";
import type { PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import { mulberry32 } from "@/shared/utils/rng.ts";
import { makeMemory, type Memory, player, run, runSilent } from "@tests/_helpers/swish.ts";
import { buildBeliefs } from "@/games/fish/server/bot/beliefs.ts";
import { snatchScore } from "@/games/fish/server/bot/snatch.ts";
import { bestSnatch } from "@/games/fish/server/bot/snatch.ts";
import { opponentRisk } from "@/games/fish/server/bot/snatch.ts";
import { decideFishMove } from "@/games/fish/server/bot/policy.ts";

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
// `buildBeliefs` and `decideFishMove` are pure functions over a snapshot, so the
// sharpest way to pin their branches is to hand them one built by hand.

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
	cardCounts: Record<PlayerId, number>;
	askHistory?: Array<{
		success: boolean;
		playerId: PlayerId;
		from: PlayerId;
		cardId: CardId;
		timestamp: number;
	}>;
	claimHistory?: Claim[];
	lastMoveType?: "ask" | "claim" | "transfer";
	split?: Record<string, PlayerId[]>;
};

const TWO_TEAMS = { T1: [ P1.id, P3.id ], T2: [ P2.id, P4.id ] };

/** A `FishPlayerView` with everything irrelevant zeroed out. */
function makeView( over: ViewOverrides ) {
	const { teams, playerData } = rosterOf( over.split ?? TWO_TEAMS );

	return FishPlayerView.make( {
		playerId: over.playerId,
		hand: over.hand,
		teams,
		playerData,
		cardCounts: over.cardCounts,
		cardLocations: over.cardLocations,
		askHistory: over.askHistory ?? [],
		claimHistory: over.claimHistory ?? [],
		transferHistory: [],
		lastMoveType: over.lastMoveType
	} );
}

/** Wraps a hand-built view in the snapshot envelope `decideFishMove` reads. */
function makeSnapshot( view: typeof FishPlayerView.Type, config = normalConfig() ) {
	const players = Object.keys( view.playerData ) as PlayerId[];

	return {
		_tag: "swish/GameSnapshot",
		id: GID,
		code: CODE,
		status: "IN_PROGRESS",
		context: {
			_tag: "swish/GameContext",
			turn: 1,
			players,
			currentPlayer: view.playerId,
			phase: "PLAY"
		},
		players: Object.fromEntries( players.map( pid => [ pid, player( pid ) ] ) ),
		config,
		view
	} as unknown as FishSnapshot;
}

const beliefsOf = ( view: typeof FishPlayerView.Type, config = normalConfig() ) =>
	buildBeliefs( view, config );

const ACES = [ "AC", "AD", "AH", "AS" ] as CardId[];

/**
 * p4 sits on three kings and needs only the fourth, which p3 provably holds —
 * hand p4 the turn and the book is gone. p2 has nothing like it going. Both are
 * equally likely to hold the ace the bot wants, so only the risk separates them.
 */
const oneDangerousOpponent = () => makeView( {
	playerId: P1.id,
	hand: [ "AC", "AS" ] as CardId[],
	cardLocations: {
		AC: [ P1.id ], AS: [ P1.id ],
		AD: [ P2.id, P4.id ], AH: [ P2.id, P4.id ],
		KC: [ P4.id ], KD: [ P4.id ], KH: [ P4.id ], KS: [ P3.id ]
	},
	cardCounts: { [ P1.id ]: 2, [ P2.id ]: 1, [ P3.id ]: 1, [ P4.id ]: 4 }
} );

// ===========================================================================
describe( "fish — bot self-play", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => {
		memory = makeMemory();
		restore = seedGlobalRandom( 101 );
	} );
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
	// the next is the failure mode worth catching. Holding books back also makes
	// termination something the policy has to earn, so the turn cap matters here.
	for ( const seed of [ 101, 2027, 55555 ] ) {
		test( `a bot-only CANADIAN game plays itself to completion (deal ${ seed })`, async () => {
			restore();
			restore = seedGlobalRandom( seed );

			const config = canadianConfig();
			const engine = await bootFish( memory, config, BOTS );

			let turns = 0;
			let status = "IN_PROGRESS";
			let claims = 0;
			let unforcedFailures = 0;

			while ( turns < MAX_TURNS ) {
				const state = await run( memory, engine.getState( BOTS[ 0 ]!.id ) );
				status = state.status;
				if ( status === "COMPLETED" ) {
					break;
				}

				// A stalled game schedules nothing; failing here beats hanging.
				expect( scheduled( memory ) ).toContain( "bot" );

				// Snapshot the actor's own view before the move, so a failed claim can
				// be judged against what the bot knew at the time.
				const actor = state.context.currentPlayer;
				const before = ( await run( memory, engine.getState( actor ) ) )
					.view as typeof FishPlayerView.Type;
				const couldAsk = bestSnatch( buildBeliefs( before, config ), before, actor ) !== undefined;

				const commits = memory.log.commits.length;
				await runSilent( memory, engine.alarm() );
				// Every move the bot picks must be one the engine accepts.
				expect( memory.log.commits.length ).toBe( commits + 1 );

				const after = ( await run( memory, engine.getState( actor ) ) )
					.view as typeof FishPlayerView.Type;

				if ( after.claimHistory.length > claims ) {
					claims = after.claimHistory.length;
					const claim = after.claimHistory[ 0 ]!;
					// The invariant this rewrite exists for: a book is only ever
					// gambled when there was no ask left to make.
					if ( !claim.success && couldAsk ) {
						unforcedFailures++;
					}
				}

				turns++;
			}

			expect( unforcedFailures ).toBe( 0 );
			expect( turns ).toBeLessThan( MAX_TURNS );
			expect( status ).toBe( "COMPLETED" );

			const view = ( await run( memory, engine.getState( BOTS[ 0 ]!.id ) ) )
				.view as typeof FishPlayerView.Type;

			// No bot ever repeats an ask it has already made. A failed ask strikes
			// both players off that card in `cardLocations`, so the belief model
			// scores the repeat at zero and never picks it — this pins that down
			// rather than leaving it to emerge. A repeat is only legitimate if the
			// card changed hands in between, which takes a successful ask for it.
			const history = [ ...view.askHistory ].reverse();
			const seen = new Map<string, number>();
			for ( let i = 0; i < history.length; i++ ) {
				const ask = history[ i ]!;
				const key = `${ ask.playerId }|${ ask.from }|${ ask.cardId }`;
				const previous = seen.get( key );
				if ( previous !== undefined ) {
					const moved = history.slice( previous + 1, i )
						.some( other => other.cardId === ask.cardId && other.success );
					expect( moved ).toBe( true );
				}

				seen.set( key, i );
			}

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
			b => getCardsOfBook( b ).some( c => view.hand.includes( c ) )
		)!;
		const cardId = getCardsOfBook( book ).find(
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
describe( "fish — beliefs", () => {

	test( "rules the bot out of every card it is not holding", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD" ] as CardId[],
			// The public tracker still lists p1 as a possible owner; the bot knows better.
			cardLocations: {
				AC: [ P1.id, P2.id ], AD: [ P1.id, P2.id ],
				AH: [ P1.id, P2.id ], AS: [ P1.id, P2.id ]
			},
			cardCounts: { [ P1.id ]: 2, [ P2.id ]: 2, [ P3.id ]: 0, [ P4.id ]: 0 }
		} );

		const beliefs = beliefsOf( view );
		expect( beliefs.owner.get( "AC" as CardId ) ).toBe( P1.id );
		expect( beliefs.owner.get( "AH" as CardId ) ).toBe( P2.id );
		expect( beliefs.owner.get( "AS" as CardId ) ).toBe( P2.id );
	} );

	test( "ignores players who are out of cards", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: { AC: [ P1.id ], AD: [ P2.id, P3.id ] },
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 1, [ P3.id ]: 0, [ P4.id ]: 0 }
		} );

		expect( beliefsOf( view ).owner.get( "AD" as CardId ) ).toBe( P2.id );
	} );

	test( "counts hands: a player with no room left drops out of every candidate set", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				AD: [ P2.id, P4.id ], AH: [ P2.id, P4.id ], AS: [ P2.id, P4.id ],
				// p4's single card is pinned here, so p4 cannot hold an ace as well.
				"2C": [ P4.id ]
			},
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 3, [ P3.id ]: 0, [ P4.id ]: 1 }
		} );

		const beliefs = beliefsOf( view );
		expect( beliefs.owner.get( "2C" as CardId ) ).toBe( P4.id );
		for ( const card of [ "AD", "AH", "AS" ] as CardId[] ) {
			expect( beliefs.owner.get( card ) ).toBe( P2.id );
		}
	} );

	test( "proves a teammate's card from the rule that you ask in a book you hold", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD", "AH" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ], AD: [ P1.id ], AH: [ P1.id ],
				AS: [ P2.id, P3.id ],
				"2C": [ P2.id ]
			},
			cardCounts: { [ P1.id ]: 3, [ P2.id ]: 1, [ P3.id ]: 1, [ P4.id ]: 0 },
			// p3 asked in ACES, so p3 holds an ace. Every ace but AS is in the bot's
			// own hand, so AS is p3's — the old signalling hunch, arriving as a proof.
			askHistory: [
				{ success: false, playerId: P3.id, from: P4.id, cardId: "AC" as CardId, timestamp: 1 }
			]
		} );

		expect( beliefsOf( view ).owner.get( "AS" as CardId ) ).toBe( P3.id );
	} );

	test( "gives every unproven card a probability row that sums to one", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				AD: [ P2.id, P3.id, P4.id ],
				AH: [ P2.id, P3.id, P4.id ],
				AS: [ P2.id, P3.id, P4.id ]
			},
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 1, [ P3.id ]: 1, [ P4.id ]: 1 }
		} );

		const beliefs = beliefsOf( view );
		for ( const card of [ "AD", "AH", "AS" ] as CardId[] ) {
			const row = beliefs.prob.get( card )!;
			const total = [ ...row.values() ].reduce( ( a, b ) => a + b, 0 );
			expect( total ).toBeCloseTo( 1, 6 );
			expect( row.get( P1.id ) ).toBeUndefined();
		}
	} );
} );

// ===========================================================================
describe( "fish — snatch scoring", () => {

	test( "scores zero for a player with no cards", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: { AC: [ P1.id ], AD: [ P2.id ] },
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 1, [ P3.id ]: 0, [ P4.id ]: 0 }
		} );

		expect( snatchScore( beliefsOf( view ), view, P3.id ) ).toBe( 0 );
	} );

	test( "finds the ask that is certain to succeed", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: { AC: [ P1.id ], AD: [ P2.id ], AH: [ P2.id ], AS: [ P2.id ] },
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 3, [ P3.id ]: 0, [ P4.id ]: 0 }
		} );

		const snatch = bestSnatch( beliefsOf( view ), view, P1.id )!;
		expect( snatch.from ).toBe( P2.id );
		expect( snatch.success ).toBeCloseTo( 1, 6 );
	} );

	test( "prices how dangerous each opponent is to hand the turn to", () => {
		const view = oneDangerousOpponent();
		const risks = opponentRisk( beliefsOf( view ), view );

		expect( risks.get( P4.id )! ).toBeGreaterThan( risks.get( P2.id )! );
	} );

	test( "prefers the book its team has nearly finished", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD", "AH", "2C" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ], AD: [ P1.id ], AH: [ P1.id ], AS: [ P2.id ],
				"2C": [ P1.id ], "2D": [ P2.id ], "2H": [ P2.id ], "2S": [ P2.id ]
			},
			cardCounts: { [ P1.id ]: 4, [ P2.id ]: 4, [ P3.id ]: 0, [ P4.id ]: 0 }
		} );

		// Both asks are certain to land; the one that completes a book wins.
		const snatch = bestSnatch( beliefsOf( view ), view, P1.id )!;
		expect( snatch.cardId ).toBe( "AS" as CardId );
		expect( snatch.book ).toBe( "ACES" );
	} );
} );

// ===========================================================================
describe( "fish — policy", () => {

	/**
	 * The bot and p3 hold every ace, so ACES is banked. The bot also holds 2C and
	 * knows exactly where the other twos are, so it has work to do; p3 has none.
	 */
	const bankedButBusy = () => makeView( {
		playerId: P1.id,
		hand: [ "AC", "AD", "2C" ] as CardId[],
		cardLocations: {
			AC: [ P1.id, P2.id ], AD: [ P1.id, P2.id ],
			// Not singletons — the bot proves these by counting, so no opponent can.
			AH: [ P2.id, P3.id ], AS: [ P2.id, P3.id ],
			"2C": [ P1.id, P2.id ], "2D": [ P2.id ], "2H": [ P4.id ], "2S": [ P4.id ]
		},
		cardCounts: { [ P1.id ]: 3, [ P2.id ]: 1, [ P3.id ]: 2, [ P4.id ]: 2 }
	} );

	test( "banks a proven book and keeps asking while it is the best placed", () => {
		const view = bankedButBusy();
		const beliefs = beliefsOf( view );

		// The book really is proven — this is a hold, not a failure to notice.
		expect( beliefs.owner.get( "AH" as CardId ) ).toBe( P3.id );
		expect( beliefs.owner.get( "AS" as CardId ) ).toBe( P3.id );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "askCard" );
	} );

	test( "cashes the banked book to hand the turn to a better placed teammate", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD", "2C" ] as CardId[],
			cardLocations: {
				AC: [ P1.id, P2.id ], AD: [ P1.id, P2.id ],
				AH: [ P2.id, P3.id ], AS: [ P2.id, P3.id ],
				KC: [ P3.id, P4.id ], KD: [ P3.id, P4.id ], KH: [ P3.id, P4.id ],
				KS: [ P2.id, P4.id ],
				"2C": [ P1.id, P2.id ],
				"2D": [ P2.id, P4.id ], "2H": [ P2.id, P4.id ], "2S": [ P2.id, P4.id ]
			},
			// p3's five cards are exactly the five that list them: both aces and
			// three kings. The bot's own twos are a coin flip between two opponents.
			cardCounts: { [ P1.id ]: 3, [ P2.id ]: 2, [ P3.id ]: 5, [ P4.id ]: 2 }
		} );

		const beliefs = beliefsOf( view );
		expect( snatchScore( beliefs, view, P3.id ) )
			.toBeGreaterThan( snatchScore( beliefs, view, P1.id ) );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "claimBook" );

		const claim = ( move.input as { claim: Record<string, PlayerId> } ).claim;
		expect( Object.keys( claim ).sort() ).toEqual( [ ...ACES ].sort() );
		expect( claim[ "AH" ] ).toBe( P3.id );
		expect( claim[ "AC" ] ).toBe( P1.id );
	} );

	test( "cashes at once when the book has become publicly provable", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD", "2C" ] as CardId[],
			cardLocations: {
				// Every ace pinned to one player in the public tracker: any opponent
				// can now claim the book out from under us.
				AC: [ P1.id ], AD: [ P1.id ], AH: [ P3.id ], AS: [ P3.id ],
				"2C": [ P1.id ], "2D": [ P2.id ], "2H": [ P4.id ], "2S": [ P4.id ]
			},
			cardCounts: { [ P1.id ]: 3, [ P2.id ]: 1, [ P3.id ]: 2, [ P4.id ]: 2 }
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "claimBook" );
	} );

	test( "cashes when it has no ask left to make", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD" ] as CardId[],
			cardLocations: {
				AC: [ P1.id, P2.id ], AD: [ P1.id, P2.id ],
				AH: [ P2.id, P3.id ], AS: [ P2.id, P3.id ],
				// The bot holds no two, so it cannot ask in TWOS.
				"2C": [ P2.id ], "2D": [ P4.id ], "2H": [ P4.id ], "2S": [ P4.id ]
			},
			cardCounts: { [ P1.id ]: 2, [ P2.id ]: 1, [ P3.id ]: 2, [ P4.id ]: 3 }
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "claimBook" );
	} );

	test( "never claims a book it cannot prove while an ask is available", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				AD: [ P2.id, P3.id, P4.id ],
				AH: [ P2.id, P3.id, P4.id ],
				AS: [ P2.id, P3.id, P4.id ]
			},
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 1, [ P3.id ]: 1, [ P4.id ]: 1 }
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "askCard" );

		const input = move.input as { from: PlayerId; cardId: CardId };
		// Only an opponent, only a card it lacks, only a book it holds.
		expect( [ P2.id, P4.id ] ).toContain( input.from );
		expect( ACES ).toContain( input.cardId );
		expect( view.hand ).not.toContain( input.cardId );
	} );

	test( "carries on with the book it was last asking in", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "2C" ] as CardId[],
			// Both books offer an even coin-flip, so nothing but the run it is on
			// should decide which one the bot asks in.
			cardLocations: {
				AC: [ P1.id ], AD: [ P2.id, P4.id ], AH: [ P2.id, P4.id ], AS: [ P2.id, P4.id ],
				"2C": [ P1.id ], "2D": [ P2.id, P4.id ], "2H": [ P2.id, P4.id ], "2S": [ P2.id, P4.id ]
			},
			cardCounts: { [ P1.id ]: 2, [ P2.id ]: 3, [ P3.id ]: 0, [ P4.id ]: 3 },
			// An opponent has taken the turn and given it back since — the bot should
			// still pick up where it left off.
			askHistory: [
				{ success: false, playerId: P2.id, from: P1.id, cardId: "3C" as CardId, timestamp: 3 },
				{ success: true, playerId: P1.id, from: P2.id, cardId: "2C" as CardId, timestamp: 2 }
			]
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "askCard" );
		expect( [ "2D", "2H", "2S" ] ).toContain( ( move.input as { cardId: CardId } ).cardId );
	} );

	test( "asks the opponent who cannot punish a miss, given the same odds", () => {
		const view = oneDangerousOpponent();
		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "askCard" );

		const input = move.input as { from: PlayerId; cardId: CardId };
		// p2 and p4 are equally likely to hold the ace, but a miss against p4
		// hands them the king they need.
		expect( input.from ).toBe( P2.id );
		expect( [ "AD", "AH" ] ).toContain( input.cardId );
	} );

	test( "asks a dangerous opponent anyway when they certainly hold the card", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AS", "AH" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ], AS: [ P1.id ], AH: [ P1.id ],
				// Nobody else can hold it, so there is no miss to be punished for.
				AD: [ P4.id ],
				KC: [ P4.id ], KD: [ P4.id ], KH: [ P4.id ], KS: [ P3.id ]
			},
			cardCounts: { [ P1.id ]: 3, [ P2.id ]: 0, [ P3.id ]: 1, [ P4.id ]: 4 }
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		const input = move.input as { from: PlayerId; cardId: CardId };
		expect( input.from ).toBe( P4.id );
		expect( input.cardId ).toBe( "AD" as CardId );
	} );

	test( "takes the long shot that closes a book over a safe ask elsewhere", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD", "AH", "2C" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ], AD: [ P1.id ], AH: [ P1.id ],
				// One ace outstanding, and only a two-in-three guess at who has it...
				AS: [ P2.id, P4.id ],
				// ...against a dead certain two, in a book still three cards from home.
				"2C": [ P1.id ], "2D": [ P2.id ], "2H": [ P2.id, P4.id ], "2S": [ P2.id, P4.id ],
				"3C": [ P4.id ]
			},
			cardCounts: { [ P1.id ]: 4, [ P2.id ]: 2, [ P3.id ]: 0, [ P4.id ]: 3 }
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "askCard" );

		const input = move.input as { from: PlayerId; cardId: CardId };
		expect( input.cardId ).toBe( "AS" as CardId );
		expect( input.from ).toBe( P4.id );
	} );

	test( "leaves a book only for one closer to closing", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "2C" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ],
				// A certain ace against a three-way guess on the twos.
				AD: [ P2.id ], AH: [ P3.id ], AS: [ P3.id ],
				"2C": [ P1.id ],
				"2D": [ P2.id, P3.id, P4.id ],
				"2H": [ P2.id, P3.id, P4.id ],
				"2S": [ P2.id, P3.id, P4.id ]
			},
			cardCounts: { [ P1.id ]: 2, [ P2.id ]: 2, [ P3.id ]: 3, [ P4.id ]: 1 },
			askHistory: [
				{ success: true, playerId: P1.id, from: P2.id, cardId: "2C" as CardId, timestamp: 1 }
			]
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( ( move.input as { cardId: CardId } ).cardId ).toBe( "AD" as CardId );
	} );

	test( "banks the book it has just finished and moves on to the next", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD", "2C" ] as CardId[],
			cardLocations: {
				AC: [ P1.id, P2.id ], AD: [ P1.id, P2.id ],
				AH: [ P2.id, P3.id ], AS: [ P2.id, P3.id ],
				"2C": [ P1.id, P2.id ], "2D": [ P2.id ], "2H": [ P4.id ], "2S": [ P4.id ]
			},
			cardCounts: { [ P1.id ]: 3, [ P2.id ]: 1, [ P3.id ]: 2, [ P4.id ]: 2 },
			// The bot was working ACES and has now completed it in team hands. The
			// book is safe where it is — no opponent can ask in a book they hold no
			// card of — so it keeps the claim in reserve and starts on TWOS.
			askHistory: [
				{ success: true, playerId: P1.id, from: P2.id, cardId: "AD" as CardId, timestamp: 1 }
			]
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "askCard" );
		expect( [ "2D", "2H", "2S" ] ).toContain( ( move.input as { cardId: CardId } ).cardId );
	} );

	test( "keeps a finished book banked when no teammate can use the turn", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [ "AC", "AD", "AH", "AS", "2C" ] as CardId[],
			cardLocations: {
				AC: [ P1.id ], AD: [ P1.id ], AH: [ P1.id ], AS: [ P1.id, P2.id ],
				"2C": [ P1.id, P2.id ], "2D": [ P2.id ], "2H": [ P4.id ], "2S": [ P4.id ]
			},
			// p3 is out of cards, so a claim buys no hand-off — hold it in reserve.
			cardCounts: { [ P1.id ]: 5, [ P2.id ]: 1, [ P3.id ]: 0, [ P4.id ]: 2 },
			askHistory: [
				{ success: true, playerId: P1.id, from: P2.id, cardId: "AS" as CardId, timestamp: 1 }
			]
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "askCard" );
	} );

	test( "hands the turn to a teammate straight after its own successful claim", () => {
		const claim: Claim = {
			success: true,
			playerId: P1.id,
			book: "ACES",
			correctClaim: {},
			actualClaim: {},
			timestamp: 1
		};

		const view = makeView( {
			playerId: P1.id,
			hand: [ "2C" ] as CardId[],
			cardLocations: { "2C": [ P1.id ], "2D": [ P3.id ], "2H": [ P2.id ], "2S": [ P4.id ] },
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 1, [ P3.id ]: 1, [ P4.id ]: 1 },
			lastMoveType: "claim",
			claimHistory: [ claim ]
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).toBe( "transferTurn" );
		expect( ( move.input as { transferTo: PlayerId } ).transferTo ).toBe( P3.id );
	} );

	test( "does not transfer to a teammate with no cards", () => {
		const claim: Claim = {
			success: true,
			playerId: P1.id,
			book: "ACES",
			correctClaim: {},
			actualClaim: {},
			timestamp: 1
		};

		const view = makeView( {
			playerId: P1.id,
			hand: [ "2C" ] as CardId[],
			cardLocations: { "2C": [ P1.id ], "2D": [ P2.id ], "2H": [ P2.id ], "2S": [ P4.id ] },
			cardCounts: { [ P1.id ]: 1, [ P2.id ]: 2, [ P3.id ]: 0, [ P4.id ]: 1 },
			lastMoveType: "claim",
			claimHistory: [ claim ]
		} );

		const move = decideFishMove( makeSnapshot( view ) )!;
		expect( move.moveType ).not.toBe( "transferTurn" );
	} );

	test( "fills the teams during TEAM_CONFIG", () => {
		const view = makeView( {
			playerId: P1.id,
			hand: [],
			cardLocations: {},
			cardCounts: { [ P1.id ]: 0, [ P2.id ]: 0, [ P3.id ]: 0, [ P4.id ]: 0 }
		} );

		const snapshot = makeSnapshot( view );
		const teamConfig = {
			...snapshot,
			context: { ...snapshot.context, phase: "TEAM_CONFIG" }
		} as FishSnapshot;

		const move = decideFishMove( teamConfig )!;
		expect( move.moveType ).toBe( "createTeams" );

		const teams = ( move.input as { teams: Record<string, PlayerId[]> } ).teams;
		expect( Object.keys( teams ) ).toHaveLength( 2 );
		expect( Object.values( teams ).flat() ).toHaveLength( 4 );
	} );
} );
