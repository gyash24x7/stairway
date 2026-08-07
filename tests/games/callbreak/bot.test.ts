import { beforeEach, describe, expect, test } from "bun:test";

import { botDeclare, botPlayCard } from "@/games/callbreak/server/bot.ts";
import { callbreak } from "@/games/callbreak/server/engine.ts";
import {
	CallbreakPlayerView,
	PublicDeal,
	Trick
} from "@/games/callbreak/shared/schema.ts";
import type { CallbreakConfig } from "@/games/callbreak/shared/schema.ts";
import {
	createNewDeal,
	determineTrickWinner,
	getPlayableCards,
	TRICKS_PER_DEAL
} from "@/games/callbreak/shared/utils.ts";
import type { CardId, CardSuit } from "@/shared/cards/schema.ts";
import { getCardSuit } from "@/shared/cards/utils.ts";
import { GameCode, GameId, PlayerId } from "@/shared/swish/schema.ts";
import { makeRng } from "@/shared/utils/rng.ts";
import { makeMemory, type Memory, player, run, runSilent } from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

const P1 = PlayerId.make( "p1" );
const P2 = PlayerId.make( "p2" );
const P3 = PlayerId.make( "p3" );
const P4 = PlayerId.make( "p4" );
const SEATS = [ P1, P2, P3, P4 ];

const CONFIG: CallbreakConfig = {
	playerCount: 4,
	autoStart: false,
	dealCount: 5,
	trumpSuit: "S"
};

const config = ( trumpSuit: CardSuit = "S" ) => ( { ...CONFIG, trumpSuit } );

/**
 * The exact shape the engine hands `botMove`: a `PlayerView` over a public deal.
 * Hands other than the bot's own are not part of it — the bot only ever reasons
 * from what its own audience is allowed to see.
 */
function viewOf( opts: {
	playerId: PlayerId;
	hand: ReadonlyArray<CardId>;
	trick?: Trick;
	declarations?: Record<string, number>;
	wins?: Record<string, number>;
} ) {
	const declarations = opts.declarations
		?? Object.fromEntries( SEATS.map( ( pid ) => [ pid, 3 ] ) );
	const wins = opts.wins ?? Object.fromEntries( SEATS.map( ( pid ) => [ pid, 0 ] ) );

	return CallbreakPlayerView.make( {
		playerId: opts.playerId,
		hand: [ ...opts.hand ],
		scores: Object.fromEntries( SEATS.map( ( pid ) => [ pid, 0 ] ) ),
		activeDeal: PublicDeal.make( {
			id: "deal-1",
			startingPlayer: P1,
			declarations,
			wins,
			scores: Object.fromEntries( SEATS.map( ( pid ) => [ pid, 0 ] ) ),
			tricks: opts.trick ? [ opts.trick ] : [ Trick.make( { leadPlayer: P1, cards: {} } ) ]
		} )
	} );
}

/** A trick built from `[ player, card ]` pairs; the first pair is the lead. */
function trickOf( played: ReadonlyArray<readonly [ PlayerId, CardId ]> ) {
	const [ lead ] = played;
	return Trick.make( {
		leadPlayer: lead![ 0 ],
		suit: getCardSuit( lead![ 1 ] ),
		cards: Object.fromEntries( played ) as Record<PlayerId, CardId>
	} );
}

// ===========================================================================
describe( "callbreak/bot — botDeclare", () => {
	test( "a bid is never below one, however weak the hand", () => {
		const junk: CardId[] = [ "2H", "3H", "4H", "2D", "3D", "4D", "5D", "2C", "3C", "4C", "5C" ];
		expect( botDeclare( viewOf( { playerId: P1, hand: junk } ), config() ) ).toBe( 1 );
	} );

	test( "high trumps drive the bid up", () => {
		const weak = viewOf( { playerId: P1, hand: [ "2S", "3S", "4S", "2H", "3H", "4H" ] } );
		const strong = viewOf( { playerId: P1, hand: [ "AS", "KS", "QS", "2H", "3H", "4H" ] } );

		expect( botDeclare( strong, config() ) )
			.toBeGreaterThan( botDeclare( weak, config() ) );
	} );

	test( "aces and guarded kings outside trump count towards the bid", () => {
		const aces = viewOf( { playerId: P1, hand: [ "AH", "AD", "AC", "2S" ] } );
		const spots = viewOf( { playerId: P1, hand: [ "5H", "5D", "5C", "2S" ] } );

		expect( botDeclare( aces, config() ) ).toBeGreaterThan( botDeclare( spots, config() ) );
		// A bare king is worth nothing; a guarded one is worth half a trick — the
		// extra low heart is the only difference between these two hands.
		const bareKing = viewOf( { playerId: P1, hand: [ "AS", "KS", "2S", "KH" ] } );
		const guardedKing = viewOf( { playerId: P1, hand: [ "AS", "KS", "2S", "KH", "3H" ] } );
		expect( botDeclare( guardedKing, config() ) )
			.toBeGreaterThan( botDeclare( bareKing, config() ) );
	} );

	test( "a void suit is only worth something when there are trumps to ruff with", () => {
		// Void in clubs and diamonds, holding trumps.
		const withTrumps = viewOf( { playerId: P1, hand: [ "AS", "2S", "3H", "4H" ] } );
		// The same shape with the trumps swapped out for the same-ranked hearts.
		const noTrumps = viewOf( { playerId: P1, hand: [ "AH", "2H", "3H", "4H" ] } );

		expect( botDeclare( withTrumps, config() ) )
			.toBeGreaterThan( botDeclare( noTrumps, config() ) );
	} );

	test( "a bid never exceeds the tricks in a deal", () => {
		const rng = makeRng( 20260807 );
		for ( let i = 0; i < 200; i++ ) {
			const deal = createNewDeal( [ ...SEATS ] );
			const trumpSuit = ( [ "H", "C", "S", "D" ] as CardSuit[] )[ rng.int( 4 ) ]!;
			for ( const pid of SEATS ) {
				const bid = botDeclare( viewOf( { playerId: pid, hand: deal.hands[ pid ]! } ),
					config( trumpSuit ) );

				expect( bid ).toBeGreaterThanOrEqual( 1 );
				expect( bid ).toBeLessThanOrEqual( TRICKS_PER_DEAL );
			}
		}
	} );
} );

// ===========================================================================
describe( "callbreak/bot — botPlayCard legality", () => {
	test( "a forced card is played without deliberation", () => {
		const view = viewOf( {
			playerId: P2,
			hand: [ "KH", "2C" ],
			trick: trickOf( [ [ P1, "5H" ] ] )
		} );

		expect( botPlayCard( view, config() ) ).toBe( "KH" );
	} );

	test( "it follows suit rather than discarding", () => {
		const view = viewOf( {
			playerId: P2,
			hand: [ "2H", "9H", "AC", "AD", "AS" ],
			trick: trickOf( [ [ P1, "5H" ] ] )
		} );

		expect( getCardSuit( botPlayCard( view, config() )! ) ).toBe( "H" );
	} );

	test( "it trumps in rather than discarding when void in the led suit", () => {
		const view = viewOf( {
			playerId: P2,
			hand: [ "2S", "9S", "AC", "AD" ],
			trick: trickOf( [ [ P1, "5H" ] ] )
		} );

		expect( getCardSuit( botPlayCard( view, config() )! ) ).toBe( "S" );
	} );

	/**
	 * The real contract: whatever the position, the bot's card is one the engine's
	 * `playCard.validate` would accept. Fuzzed over real deals, with the trick
	 * itself built by playing legal cards, so every seat gets asked from a
	 * position that could actually arise.
	 */
	test( "every card the bot picks is one the rules allow", () => {
		const rng = makeRng( 424242 );
		let asked = 0;

		for ( let round = 0; round < 60; round++ ) {
			const trumpSuit = ( [ "H", "C", "S", "D" ] as CardSuit[] )[ rng.int( 4 ) ]!;
			const cfg = config( trumpSuit );
			const deal = createNewDeal( [ ...SEATS ] );
			const hands = Object.fromEntries(
				SEATS.map( ( pid ) => [ pid, [ ...deal.hands[ pid ]! ] ] )
			) as Record<PlayerId, CardId[]>;

			const declarations = Object.fromEntries(
				SEATS.map( ( pid ) => [ pid, 1 + rng.int( 5 ) ] )
			);
			const wins = Object.fromEntries( SEATS.map( ( pid ) => [ pid, 0 ] ) );

			let leader = SEATS[ rng.int( 4 ) ]!;

			for ( let t = 0; t < TRICKS_PER_DEAL; t++ ) {
				const order = SEATS.map( ( _, i ) => SEATS[ ( SEATS.indexOf( leader ) + i ) % 4 ]! );
				let trick = Trick.make( { leadPlayer: leader, cards: {} } );

				for ( const pid of order ) {
					const view = viewOf( {
						playerId: pid,
						hand: hands[ pid ]!,
						trick,
						declarations,
						wins
					} );

					const picked = botPlayCard( view, cfg );
					const playable = getPlayableCards( [ ...hands[ pid ]! ], trumpSuit, trick );

					expect( picked ).toBeDefined();
					expect( playable ).toContain( picked! );
					asked++;

					hands[ pid ] = hands[ pid ]!.filter( ( c ) => c !== picked );
					trick = Trick.make( {
						leadPlayer: trick.leadPlayer,
						suit: trick.suit ?? getCardSuit( picked! ),
						cards: { ...trick.cards, [ pid ]: picked! }
					} );
				}

				leader = determineTrickWinner( trick, trumpSuit, [ ...SEATS ] );
				wins[ leader ] = ( wins[ leader ] ?? 0 ) + 1;
			}

			expect( SEATS.every( ( pid ) => hands[ pid ]!.length === 0 ) ).toBe( true );
			expect( SEATS.reduce( ( sum, pid ) => sum + ( wins[ pid ] ?? 0 ), 0 ) )
				.toBe( TRICKS_PER_DEAL );
		}

		expect( asked ).toBe( 60 * TRICKS_PER_DEAL * 4 );
	} );
} );

// ===========================================================================
describe( "callbreak/bot — play style", () => {
	test( "a bot that has made its bid dumps its lowest card", () => {
		const view = viewOf( {
			playerId: P1,
			hand: [ "2H", "AH", "KH" ],
			declarations: { p1: 1, p2: 3, p3: 3, p4: 3 },
			wins: { p1: 1, p2: 0, p3: 0, p4: 0 }
		} );

		expect( botPlayCard( view, config() ) ).toBe( "2H" );
	} );

	test( "a bot still chasing tricks leads a top non-trump honour", () => {
		const view = viewOf( {
			playerId: P1,
			hand: [ "2H", "AH", "5S" ],
			declarations: { p1: 3, p2: 3, p3: 3, p4: 3 },
			wins: { p1: 0, p2: 0, p3: 0, p4: 0 }
		} );

		expect( botPlayCard( view, config() ) ).toBe( "AH" );
	} );

	test( "with no non-trump honour to lead it opens with its highest trump", () => {
		const view = viewOf( {
			playerId: P1,
			hand: [ "5H", "6H", "9S", "2S" ],
			declarations: { p1: 3, p2: 3, p3: 3, p4: 3 },
			wins: { p1: 0, p2: 0, p3: 0, p4: 0 }
		} );

		expect( botPlayCard( view, config() ) ).toBe( "9S" );
	} );

	test( "following, it takes the trick with the cheapest winner it holds", () => {
		const view = viewOf( {
			playerId: P2,
			hand: [ "7H", "9H", "AH" ],
			trick: trickOf( [ [ P1, "5H" ] ] ),
			declarations: { p1: 3, p2: 3, p3: 3, p4: 3 },
			wins: { p1: 0, p2: 0, p3: 0, p4: 0 }
		} );

		expect( botPlayCard( view, config() ) ).toBe( "7H" );
	} );

	test( "it does not waste a high card on a trick a trump has already taken", () => {
		const view = viewOf( {
			playerId: P3,
			hand: [ "2H", "AH" ],
			trick: trickOf( [ [ P1, "5H" ], [ P2, "9S" ] ] ),
			declarations: { p1: 3, p2: 3, p3: 3, p4: 3 },
			wins: { p1: 0, p2: 0, p3: 0, p4: 0 }
		} );

		expect( botPlayCard( view, config() ) ).toBe( "2H" );
	} );

	test( "void in both, it discards the lowest card of its longest side suit", () => {
		const view = viewOf( {
			playerId: P3,
			hand: [ "AD", "2C", "5C", "9C" ],
			trick: trickOf( [ [ P1, "5H" ], [ P2, "9H" ] ] ),
			declarations: { p1: 3, p2: 3, p3: 3, p4: 3 },
			wins: { p1: 0, p2: 0, p3: 0, p4: 0 }
		} );

		expect( botPlayCard( view, config() ) ).toBe( "2C" );
	} );
} );

// ===========================================================================
describe( "callbreak/bot — driven by the engine", () => {
	let memory: Memory;
	const BOTS = [
		player( "p1", true ),
		player( "p2", true ),
		player( "p3", true ),
		player( "p4", true )
	];

	beforeEach( () => { memory = makeMemory(); } );

	/** initialize → seat four bots → start. */
	async function bootBots( dealCount = 5 ) {
		const engine = await run( memory, callbreak );
		await run( memory, engine.initialize( {
			id: GID,
			code: CODE,
			config: { ...CONFIG, dealCount },
			seed: "seed"
		} ) );

		for ( const bot of BOTS ) {
			await run( memory, engine.join( bot ) );
		}

		await run( memory, engine.start( BOTS[ 0 ]!.id ) );
		return engine;
	}

	/** Fires alarms until nothing more is armed, capped so a stall fails rather than hangs. */
	async function drive( engine: Awaited<ReturnType<typeof bootBots>>, cap: number ) {
		let steps = 0;
		while ( memory.scheduler.scheduled.length > 0 && steps < cap ) {
			await runSilent( memory, engine.alarm() );
			steps++;
		}

		return steps;
	}

	const stored = () => memory.store.value as {
		status: string;
		context: { phase?: string };
		state: { deals: Array<{ declarations: Record<string, number>; tricks: Array<unknown> }> };
	};

	test( "addBots fills the empty seats", async () => {
		const engine = await run( memory, callbreak );
		await run( memory, engine.initialize( { id: GID, code: CODE, config: CONFIG, seed: "s" } ) );
		await run( memory, engine.join( player( "human" ) ) );
		await run( memory, engine.addBots( PlayerId.make( "human" ) ) );

		const state = await run( memory, engine.getState( PlayerId.make( "human" ) ) );
		const roster = Object.values( state.players );
		expect( roster ).toHaveLength( 4 );
		expect( roster.filter( ( p ) => p.isBot ) ).toHaveLength( 3 );
	} );

	test( "a bot on turn gets an alarm, and the alarm makes it declare", async () => {
		const engine = await bootBots();
		expect( memory.scheduler.scheduled.map( ( s ) => s.alarm ) ).toContain( "bot" );

		await runSilent( memory, engine.alarm() );

		const deal = stored().state.deals[ 0 ]!;
		expect( deal.declarations[ P1 ] ).toBeGreaterThanOrEqual( 1 );
		expect( deal.declarations[ P1 ] ).toBeLessThanOrEqual( TRICKS_PER_DEAL );
	} );

	test( "four bots bid round the table and play a complete opening trick", async () => {
		const engine = await bootBots();
		// 4 declarations + 4 cards is all it takes; the cap catches an early stall.
		const steps = await drive( engine, 12 );

		const deal = stored().state.deals[ 0 ]!;
		expect( stored().context.phase ).toBe( "PLAYING" );
		expect( Object.values( deal.declarations ).every( ( d ) => d >= 1 ) ).toBe( true );

		const trick = deal.tricks[ 0 ] as { cards: Record<string, CardId>; winner?: PlayerId };
		expect( Object.keys( trick.cards ) ).toHaveLength( 4 );
		expect( trick.winner ).toBeDefined();
		expect( steps ).toBeGreaterThanOrEqual( 8 );
	} );

	// ~270 engine commands (5 deals x 56 moves), so it needs more than bun's 5s
	// default — it passes alone at ~5s but tips over under full-suite load.
	test( "a bot-vs-bot game runs to completion", async () => {
		const engine = await bootBots( 5 );
		// 5 deals x (4 declarations + 52 cards), with headroom.
		const steps = await drive( engine, 1000 );

		expect( steps ).toBeLessThan( 1000 );
		expect( stored().status ).toBe( "COMPLETED" );
	}, 30_000 );
} );
