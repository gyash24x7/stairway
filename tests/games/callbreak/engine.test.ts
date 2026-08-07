import { beforeEach, describe, expect, test } from "bun:test";

import { callbreak } from "@/games/callbreak/server/engine.ts";
import type {
	CallbreakConfig,
	CallbreakPlayerView,
	CallbreakTableView,
	CallbreakView
} from "@/games/callbreak/shared/schema.ts";
import type { CardId, CardSuit } from "@/shared/cards/schema.ts";
import { GameCode, GameId, PlayerId } from "@/shared/swish/schema.ts";
import type { PlayerInfo } from "@/shared/swish/schema.ts";
import { makeMemory, type Memory, player, run, runFail } from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

const P1 = player( "p1" );
const P2 = player( "p2" );
const P3 = player( "p3" );
const P4 = player( "p4" );
const SEATED = [ P1, P2, P3, P4 ];
/** Never joins anything — used to prove `assertMember` gates each command. */
const STRANGER = player( "p9" );

const CONFIG: CallbreakConfig = {
	playerCount: 4,
	autoStart: false,
	dealCount: 5,
	trumpSuit: "S"
};

// --- Looking inside the fake store ------------------------------------------
// `getState` is member-only and redacted, so the persisted snapshot is the only
// place the *whole* deal (every hand) can be read — which is exactly what the
// redaction tests need to assert against.

interface StoredTrick {
	leadPlayer: PlayerId;
	suit?: CardSuit;
	cards: Record<string, CardId>;
	winner?: PlayerId;
}

interface StoredDeal {
	id: string;
	startingPlayer: PlayerId;
	hands: Record<string, CardId[]>;
	declarations: Record<string, number>;
	wins: Record<string, number>;
	scores: Record<string, number>;
	tricks: StoredTrick[];
}

interface Stored {
	status: string;
	context: {
		turn: number;
		players: PlayerId[];
		currentPlayer: PlayerId;
		phase?: string;
	};
	config: CallbreakConfig;
	state: {
		deals: StoredDeal[];
		scores: Record<string, number>;
		winner?: PlayerId;
	};
}

const stored = ( memory: Memory ) => memory.store.value as Stored;
const activeDeal = ( memory: Memory ) => stored( memory ).state.deals[ 0 ]!;
const dealId = ( memory: Memory ) => activeDeal( memory ).id;

/**
 * Rewrites the persisted snapshot through an unfrozen deep copy (the reducer's
 * immer output is frozen). This is how the tests below reach board positions —
 * a chosen hand, a deal twelve tricks deep — that would otherwise cost dozens of
 * moves to reach.
 */
const patchStore = ( memory: Memory, patch: ( snapshot: Stored ) => void ) => {
	const snapshot = structuredClone( memory.store.value ) as Stored;
	patch( snapshot );
	memory.store.value = snapshot;
};

/** Replaces the named players' hands in the active deal. */
const setHands = ( memory: Memory, hands: Record<string, ReadonlyArray<CardId>> ) =>
	patchStore( memory, ( snapshot ) => {
		const deal = snapshot.state.deals[ 0 ]!;
		for ( const [ pid, cards ] of Object.entries( hands ) ) {
			deal.hands[ pid ] = [ ...cards ];
		}
	} );

/** The table + per-player payload of the most recent broadcast. */
const lastBroadcast = ( memory: Memory ) => memory.broadcasts.at( -1 )! as {
	channel: string;
	snapshot: {
		table: { view: CallbreakTableView };
		playerViews: Record<string, { view: CallbreakPlayerView }>;
	};
};

/** Narrows a snapshot's view to the private (player) variant. */
function asPlayerView( view: CallbreakView ) {
	if ( view._tag !== "callbreak/PlayerView" ) {
		throw new Error( `expected a player view, got ${ view._tag }` );
	}

	return view;
}

/** Brands the keys of a plain `{ p1: … }` literal so it can be compared to a view. */
const scoreTable = ( entries: Record<string, number> ) => entries as Record<PlayerId, number>;

const byId = ( id: PlayerId ) => SEATED.find( ( p ) => p.id === id )!;

// --- Booting a game ---------------------------------------------------------

/** initialize → join every player → (optionally) start. Lands in `DECLARING`. */
async function boot(
	memory: Memory,
	opts: {
		config?: Partial<CallbreakConfig>;
		players?: ReadonlyArray<PlayerInfo>;
		start?: boolean;
	} = {}
) {
	const engine = await run( memory, callbreak );
	const config = { ...CONFIG, ...opts.config };
	const players = opts.players ?? SEATED;

	await run( memory, engine.initialize( { id: GID, code: CODE, config, seed: "seed" } ) );
	for ( const p of players ) {
		await run( memory, engine.join( p ) );
	}

	if ( opts.start !== false ) {
		await run( memory, engine.start( players[ 0 ]!.id ) );
	}

	return engine;
}

type Engine = Awaited<ReturnType<typeof boot>>;

/**
 * Declares for all four seats in the engine's own order (which starts at the
 * deal's starting player and rotates), ending the `DECLARING` phase.
 */
async function declareAll(
	memory: Memory,
	engine: Engine,
	bids: Record<string, number> = {}
) {
	const id = dealId( memory );
	for ( let i = 0; i < 4; i++ ) {
		const pid = stored( memory ).context.currentPlayer;
		await run( memory, engine.declareWins( { wins: bids[ pid ] ?? 2, dealId: id }, byId( pid ) ) );
	}
}

/** boot → declare for everyone. Lands on the first trick of `PLAYING`. */
async function bootPlaying(
	memory: Memory,
	opts: { config?: Partial<CallbreakConfig>; bids?: Record<string, number> } = {}
) {
	const engine = await boot( memory, { config: opts.config } );
	await declareAll( memory, engine, opts.bids );
	return engine;
}

/** Plays one card for whoever is on turn. */
const play = ( memory: Memory, engine: Engine, cardId: CardId ) =>
	run( memory, engine.playCard(
		{ cardId, dealId: dealId( memory ) },
		byId( stored( memory ).context.currentPlayer )
	) );

/**
 * Fast-forwards the active deal to its thirteenth trick: banks `wins` as already
 * completed tricks and leaves the live (empty) trick on top, then deals each seat
 * the single card it is about to play.
 */
const primeFinalTrick = (
	memory: Memory,
	wins: Record<string, number>,
	hands: Record<string, CardId>
) => patchStore( memory, ( snapshot ) => {
	const deal = snapshot.state.deals[ 0 ]!;
	const done = Object.entries( wins ).flatMap( ( [ pid, count ] ) =>
		Array.from( { length: count }, () => ( {
			leadPlayer: PlayerId.make( pid ),
			cards: {},
			winner: PlayerId.make( pid )
		} ) ) );

	deal.wins = { ...wins };
	deal.tricks = [ deal.tricks[ 0 ]!, ...done ];
	for ( const [ pid, card ] of Object.entries( hands ) ) {
		deal.hands[ pid ] = [ card ];
	}
} );

// ===========================================================================
describe( "callbreak — setup & dealing", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "starting deals thirteen cards to each of the four seats", async () => {
		await boot( memory );
		const deal = activeDeal( memory );
		const hands = SEATED.map( ( p ) => deal.hands[ p.id ]! );

		expect( hands.map( ( h ) => h.length ) ).toEqual( [ 13, 13, 13, 13 ] );
		expect( new Set( hands.flat() ).size ).toBe( 52 );
		expect( deal.startingPlayer ).toBe( P1.id );
		expect( deal.tricks ).toEqual( [] );
	} );

	for ( const dealCount of [ 5, 9, 13 ] ) {
		for ( const trumpSuit of [ "H", "C", "S", "D" ] as ReadonlyArray<CardSuit> ) {
			test( `a ${ dealCount }-deal game with ${ trumpSuit } as trump deals a full pack`,
				async () => {
					await boot( memory, { config: { dealCount, trumpSuit } } );
					const deal = activeDeal( memory );
					const dealt = SEATED.flatMap( ( p ) => deal.hands[ p.id ]! );

					expect( dealt ).toHaveLength( 52 );
					expect( new Set( dealt ).size ).toBe( 52 );
					expect( stored( memory ).config ).toEqual( { ...CONFIG, dealCount, trumpSuit } );
				} );
		}
	}

	test( "the dealt deal is captured in the log, so a refold reproduces it exactly", async () => {
		const engine = await boot( memory );
		const before = structuredClone( activeDeal( memory ) );

		await run( memory, engine.declareWins( { wins: 3, dealId: before.id }, P1 ) );
		// undo/redo rebuild state by replaying the log from genesis — the deal comes
		// back from its `DealDealt` event, not from a re-shuffle.
		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.redo( P1 ) );

		expect( activeDeal( memory ).id ).toBe( before.id );
		expect( activeDeal( memory ).hands ).toEqual( before.hands );
	} );

	// KNOWN BUG — `createNewDeal` (src/games/callbreak/shared/utils.ts:65) shuffles
	// with the default `Math.random` and mints the deal id with `generateId()`,
	// ignoring the engine's seeded `rng`. Two games started from the same seed get
	// different deals, so the seed does NOT determine the deal.
	test.skip( "a fixed seed yields a fixed deal", async () => {
		const first = makeMemory();
		const second = makeMemory();
		await boot( first );
		await boot( second );

		expect( activeDeal( first ).hands ).toEqual( activeDeal( second ).hands );
	} );
} );

// ===========================================================================
describe( "callbreak — view redaction", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a player sees their own hand and nobody else's card, while declaring", async () => {
		const engine = await boot( memory );
		const deal = activeDeal( memory );
		const view = asPlayerView( ( await run( memory, engine.getState( P1.id ) ) ).view );

		expect( view.playerId ).toBe( P1.id );
		expect( view.hand ).toEqual( deal.hands[ P1.id ]! );

		// Nothing belonging to another seat appears anywhere in p1's snapshot.
		const json = JSON.stringify( view );
		const foreign = [ P2, P3, P4 ].flatMap( ( p ) => deal.hands[ p.id ]! );
		expect( foreign.filter( ( card ) => json.includes( `"${ card }"` ) ) ).toEqual( [] );

		// The public board carries the deal with `hands` stripped entirely.
		expect( view.activeDeal ).toBeDefined();
		expect( Object.keys( view.activeDeal! ) ).not.toContain( "hands" );
	} );

	test( "a player still sees only their own hand once cards are on the table", async () => {
		const engine = await bootPlaying( memory );
		// All four hands are replaced so the fixture stays a legal, duplicate-free deal.
		setHands( memory, {
			p1: [ "AH", "2C" ],
			p2: [ "KH", "3C" ],
			p3: [ "QH", "4C" ],
			p4: [ "JH", "5C" ]
		} );
		await play( memory, engine, "AH" );

		const deal = activeDeal( memory );
		const view = asPlayerView( ( await run( memory, engine.getState( P2.id ) ) ).view );

		// The played card is public — it is on the trick, not in a hand.
		expect( view.activeDeal!.tricks[ 0 ]!.cards[ P1.id ] ).toBe( "AH" );
		expect( view.hand ).toEqual( deal.hands[ P2.id ]! );

		const json = JSON.stringify( view );
		const foreign = [ P1, P3, P4 ].flatMap( ( p ) => deal.hands[ p.id ]! );
		expect( foreign.filter( ( card ) => json.includes( `"${ card }"` ) ) ).toEqual( [] );
	} );

	test( "the broadcast table projection carries no hand and no player identity", async () => {
		await boot( memory );
		const deal = activeDeal( memory );
		const last = lastBroadcast( memory );

		expect( last.channel ).toBe( "callbreak:g1" );
		expect( last.snapshot.table.view._tag ).toBe( "callbreak/TableView" );
		expect( Object.keys( last.snapshot.table.view ) ).not.toContain( "hand" );
		expect( Object.keys( last.snapshot.table.view ) ).not.toContain( "playerId" );
		expect( Object.keys( last.snapshot.table.view.activeDeal! ) ).not.toContain( "hands" );

		// No card at all reaches the table audience.
		const json = JSON.stringify( last.snapshot.table );
		const dealt = SEATED.flatMap( ( p ) => deal.hands[ p.id ]! );
		expect( dealt.filter( ( card ) => json.includes( `"${ card }"` ) ) ).toEqual( [] );
	} );

	test( "each broadcast per-player snapshot carries exactly that seat's hand", async () => {
		await boot( memory );
		const deal = activeDeal( memory );
		const { playerViews } = lastBroadcast( memory ).snapshot;

		expect( Object.keys( playerViews ).sort() ).toEqual( [ "p1", "p2", "p3", "p4" ] );
		for ( const p of SEATED ) {
			expect( playerViews[ p.id ]!.view.hand ).toEqual( deal.hands[ p.id ]! );
		}
	} );

	test( "both projections publish the same public board", async () => {
		await boot( memory );
		const { table, playerViews } = lastBroadcast( memory ).snapshot;

		expect( playerViews[ P1.id ]!.view.activeDeal ).toEqual( table.view.activeDeal );
		expect( playerViews[ P1.id ]!.view.scores ).toEqual( table.view.scores );
	} );
} );

// ===========================================================================
describe( "callbreak — the phase machine", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a started game opens in DECLARING, on the deal's starting player", async () => {
		const engine = await boot( memory );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.phase ).toBe( "DECLARING" );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "playing a card while declaring is rejected (MoveNotAllowed)", async () => {
		const engine = await boot( memory );
		const cardId = activeDeal( memory ).hands[ P1.id ]![ 0 ]!;

		const error = await runFail( memory, engine.playCard(
			{ cardId, dealId: dealId( memory ) },
			P1
		) );
		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "declarations rotate round the table without starting play early", async () => {
		const engine = await boot( memory );
		const id = dealId( memory );

		await run( memory, engine.declareWins( { wins: 2, dealId: id }, P1 ) );
		expect( stored( memory ).context.currentPlayer ).toBe( P2.id );

		await run( memory, engine.declareWins( { wins: 3, dealId: id }, P2 ) );
		await run( memory, engine.declareWins( { wins: 4, dealId: id }, P3 ) );

		// Three of four in: still declaring, no trick opened.
		expect( stored( memory ).context.phase ).toBe( "DECLARING" );
		expect( activeDeal( memory ).tricks ).toEqual( [] );
		expect( stored( memory ).context.currentPlayer ).toBe( P4.id );
	} );

	test( "the fourth declaration flips to PLAYING and opens the first trick", async () => {
		const engine = await bootPlaying( memory, { bids: { p1: 2, p2: 3, p3: 4, p4: 5 } } );
		const state = await run( memory, engine.getState( P1.id ) );
		const deal = activeDeal( memory );

		expect( state.context.phase ).toBe( "PLAYING" );
		expect( deal.declarations ).toEqual( { p1: 2, p2: 3, p3: 4, p4: 5 } );
		expect( deal.tricks ).toHaveLength( 1 );
		expect( deal.tricks[ 0 ]!.leadPlayer ).toBe( P1.id );
		expect( deal.tricks[ 0 ]!.cards ).toEqual( {} );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "declaring once play has begun is rejected (MoveNotAllowed)", async () => {
		const engine = await bootPlaying( memory );

		const error = await runFail( memory, engine.declareWins(
			{ wins: 2, dealId: dealId( memory ) },
			P1
		) );
		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );
} );

// ===========================================================================
describe( "callbreak — declareWins validation", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "declaring against a stale deal id is rejected", async () => {
		const engine = await boot( memory );

		const error = await runFail( memory, engine.declareWins(
			{ wins: 2, dealId: "not-the-active-deal" },
			P1
		) );
		expect( error ).toMatchObject( {
			_tag: "swish/InvalidMove",
			move: "declareWins",
			reason: "Active Deal Not Found!"
		} );
	} );

	test( "declaring twice in one deal is rejected", async () => {
		const engine = await boot( memory );
		const id = dealId( memory );
		await run( memory, engine.declareWins( { wins: 2, dealId: id }, P1 ) );

		// The turn has already moved on, so hand it back to p1 to reach the
		// "already declared" guard rather than the turn guard.
		patchStore( memory, ( s ) => { s.context.currentPlayer = P1.id; } );

		const error = await runFail( memory, engine.declareWins( { wins: 4, dealId: id }, P1 ) );
		expect( error ).toMatchObject( {
			_tag: "swish/InvalidMove",
			move: "declareWins",
			reason: "Already declared wins!"
		} );
	} );

	test( "declaring out of turn is rejected (NotYourTurn)", async () => {
		const engine = await boot( memory );

		const error = await runFail( memory, engine.declareWins(
			{ wins: 2, dealId: dealId( memory ) },
			P3
		) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	// KNOWN BUG — `declareWins.validate` (src/games/callbreak/server/engine.ts:124)
	// never bounds `input.wins`. The 2..13 range is enforced only by the client
	// stepper (src/games/callbreak/client/declare-wins.tsx:53), so the API accepts
	// a bid of 0 (which also wedges the phase: `DECLARING.endIf` waits for every
	// declaration to be > 0) or of 99.
	test.skip( "a bid outside 1..13 is rejected", async () => {
		const engine = await boot( memory );
		const id = dealId( memory );

		expect( ( await runFail( memory, engine.declareWins( { wins: 0, dealId: id }, P1 ) ) )._tag )
			.toBe( "swish/InvalidMove" );
		expect( ( await runFail( memory, engine.declareWins( { wins: 14, dealId: id }, P1 ) ) )._tag )
			.toBe( "swish/InvalidMove" );
	} );
} );

// ===========================================================================
describe( "callbreak — playCard validation (the follow-suit rules)", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	/** Rejects `card` for whoever is on turn, returning the typed error. */
	const reject = ( engine: Engine, card: CardId ) =>
		runFail( memory, engine.playCard(
			{ cardId: card, dealId: dealId( memory ) },
			byId( stored( memory ).context.currentPlayer )
		) );

	test( "playing against a stale deal id is rejected", async () => {
		const engine = await bootPlaying( memory );
		const cardId = activeDeal( memory ).hands[ P1.id ]![ 0 ]!;

		const error = await runFail( memory, engine.playCard(
			{ cardId, dealId: "not-the-active-deal" },
			P1
		) );
		expect( error ).toMatchObject( {
			_tag: "swish/InvalidMove",
			reason: "Active Deal Not Found!"
		} );
	} );

	test( "playing with no trick open is rejected", async () => {
		const engine = await bootPlaying( memory );
		const cardId = activeDeal( memory ).hands[ P1.id ]![ 0 ]!;
		patchStore( memory, ( s ) => { s.state.deals[ 0 ]!.tricks = []; } );

		const error = await runFail( memory, engine.playCard(
			{ cardId, dealId: dealId( memory ) },
			P1
		) );
		expect( error ).toMatchObject( {
			_tag: "swish/InvalidMove",
			reason: "Active Trick Not Found!"
		} );
	} );

	test( "playing a card you do not hold is rejected", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, { p1: [ "AH", "2C" ] } );

		expect( await reject( engine, "KD" ) ).toMatchObject( {
			_tag: "swish/InvalidMove",
			move: "playCard",
			reason: "Card not in hand!"
		} );
	} );

	test( "playing out of turn is rejected (NotYourTurn)", async () => {
		const engine = await bootPlaying( memory );
		const cardId = activeDeal( memory ).hands[ P3.id ]![ 0 ]!;

		const error = await runFail( memory, engine.playCard(
			{ cardId, dealId: dealId( memory ) },
			P3
		) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "playing twice into the same trick is rejected", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, { p1: [ "AH", "KH" ], p2: [ "2H", "3H" ] } );
		await play( memory, engine, "AH" );

		// The turn has moved to p2; hand it back so the "already played" guard is
		// what rejects p1, not the turn guard.
		patchStore( memory, ( s ) => { s.context.currentPlayer = P1.id; } );

		expect( await reject( engine, "KH" ) ).toMatchObject( {
			_tag: "swish/InvalidMove",
			reason: "Already played card!"
		} );
	} );

	test( "discarding while holding the led suit is rejected", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, { p1: [ "5H" ], p2: [ "9H", "2C", "AD" ] } );
		await play( memory, engine, "5H" );

		expect( await reject( engine, "2C" ) ).toMatchObject( {
			_tag: "swish/InvalidMove",
			reason: "Card cannot be played!"
		} );
	} );

	test( "under-playing the led suit while able to head it is rejected", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, { p1: [ "5H" ], p2: [ "9H", "2H" ] } );
		await play( memory, engine, "5H" );

		expect( await reject( engine, "2H" ) ).toMatchObject( {
			_tag: "swish/InvalidMove",
			reason: "Card cannot be played!"
		} );
	} );

	test( "a low card of the led suit is fine when the trick cannot be headed", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, { p1: [ "AH" ], p2: [ "9H", "2H" ] } );
		await play( memory, engine, "AH" );
		await play( memory, engine, "2H" );

		expect( activeDeal( memory ).tricks[ 0 ]!.cards[ P2.id ] ).toBe( "2H" );
	} );

	test( "discarding instead of trumping when void in the led suit is rejected", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, { p1: [ "5H" ], p2: [ "2S", "AC", "AD" ] } );
		await play( memory, engine, "5H" );

		expect( await reject( engine, "AC" ) ).toMatchObject( {
			_tag: "swish/InvalidMove",
			reason: "Card cannot be played!"
		} );

		// The trump it was holding out on is accepted.
		await play( memory, engine, "2S" );
		expect( activeDeal( memory ).tricks[ 0 ]!.cards[ P2.id ] ).toBe( "2S" );
	} );

	test( "under-trumping while able to over-trump is rejected", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, {
			p1: [ "5H" ],
			p2: [ "3S" ],
			p3: [ "2S", "9S", "AC" ]
		} );
		await play( memory, engine, "5H" );
		await play( memory, engine, "3S" );

		expect( await reject( engine, "2S" ) ).toMatchObject( {
			_tag: "swish/InvalidMove",
			reason: "Card cannot be played!"
		} );

		await play( memory, engine, "9S" );
		expect( activeDeal( memory ).tricks[ 0 ]!.cards[ P3.id ] ).toBe( "9S" );
	} );

	test( "any card goes once the trick can no longer be over-trumped", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, {
			p1: [ "5H" ],
			p2: [ "9S" ],
			p3: [ "2S", "AC" ]
		} );
		await play( memory, engine, "5H" );
		await play( memory, engine, "9S" );

		// p3 is void in hearts and cannot beat 9S, so the whole hand opens up.
		await play( memory, engine, "AC" );
		expect( activeDeal( memory ).tricks[ 0 ]!.cards[ P3.id ] ).toBe( "AC" );
	} );

	test( "a non-member can neither read the game nor play into it", async () => {
		const engine = await bootPlaying( memory );

		expect( ( await runFail( memory, engine.getState( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
		expect( ( await runFail( memory, engine.playCard(
			{ cardId: "AS", dealId: dealId( memory ) },
			STRANGER
		) ) )._tag ).toBe( "swish/NotAMember" );
	} );
} );

// ===========================================================================
describe( "callbreak — trick resolution", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	/**
	 * Deals each seat the single card it is about to play — with a one-card hand
	 * every assignment is legal, so the fixture states *only* the outcome under
	 * test — then plays them all out in turn order.
	 */
	async function playTrick( engine: Engine, cards: Record<string, CardId> ) {
		setHands( memory, Object.fromEntries(
			Object.entries( cards ).map( ( [ pid, card ] ) => [ pid, [ card ] ] )
		) );

		for ( let i = 0; i < 4; i++ ) {
			const pid = stored( memory ).context.currentPlayer;
			await play( memory, engine, cards[ pid ]! );
		}

		return activeDeal( memory ).tricks[ 0 ]!;
	}

	const cases: ReadonlyArray<{
		name: string;
		cards: Record<string, CardId>;
		winner: PlayerId;
	}> = [
		{
			name: "the highest card of the led suit wins",
			cards: { p1: "5H", p2: "9H", p3: "KH", p4: "2H" },
			winner: P3.id
		},
		{
			name: "off-suit discards cannot take the trick from the leader",
			cards: { p1: "AH", p2: "2H", p3: "AC", p4: "AD" },
			winner: P1.id
		},
		{
			name: "a trump beats the highest card of the led suit",
			cards: { p1: "AH", p2: "KH", p3: "2S", p4: "QH" },
			winner: P3.id
		},
		{
			name: "the highest trump wins a trumped trick",
			cards: { p1: "AH", p2: "2S", p3: "KS", p4: "3C" },
			winner: P3.id
		},
		{
			name: "a trump lead is decided by the highest trump",
			cards: { p1: "5S", p2: "9S", p3: "2S", p4: "KS" },
			winner: P4.id
		}
	];

	for ( const { name, cards, winner } of cases ) {
		test( name, async () => {
			const engine = await bootPlaying( memory );
			const trick = await playTrick( engine, cards );

			expect( trick.cards ).toEqual( cards );
			expect( trick.suit ).toBe( cards[ P1.id ]!.charAt( 1 ) as CardSuit );
			expect( trick.winner ).toBe( winner );
			expect( activeDeal( memory ).wins[ winner ] ).toBe( 1 );
			// The trick winner is handed the lead for the next one.
			expect( stored( memory ).context.currentPlayer ).toBe( winner );
		} );
	}

	test( "a completed trick empties the four hands it was played from", async () => {
		const engine = await bootPlaying( memory );
		await playTrick( engine, { p1: "5H", p2: "9H", p3: "KH", p4: "2H" } );

		const deal = activeDeal( memory );
		expect( SEATED.map( ( p ) => deal.hands[ p.id ]! ) ).toEqual( [ [], [], [], [] ] );
	} );

	// KNOWN BUG — `submitMove` runs `validate` against the pre-move snapshot, so
	// `playCard.validate` (src/games/callbreak/server/engine.ts:145) still sees the
	// COMPLETED trick that `hooks.beforeMove` is about to replace. The winner's own
	// card is on that trick, so the winner is rejected with "Already played card!"
	// and can never lead the next one: the deal wedges after trick 1. (The client
	// already special-cases a finished trick — src/games/callbreak/client/hand-view.tsx:24.)
	test.skip( "the trick winner leads the next trick", async () => {
		const engine = await bootPlaying( memory );
		setHands( memory, {
			p1: [ "5H", "2C" ],
			p2: [ "9H", "3C" ],
			p3: [ "KH", "4C" ],
			p4: [ "2H", "5C" ]
		} );

		for ( const card of [ "5H", "9H", "KH", "2H" ] as ReadonlyArray<CardId> ) {
			await play( memory, engine, card );
		}

		expect( stored( memory ).context.currentPlayer ).toBe( P3.id );
		await play( memory, engine, "4C" );

		const deal = activeDeal( memory );
		expect( deal.tricks ).toHaveLength( 2 );
		expect( deal.tricks[ 0 ]!.leadPlayer ).toBe( P3.id );
		expect( deal.tricks[ 0 ]!.cards ).toEqual( { p3: "4C" } );
	} );
} );

// ===========================================================================
describe( "callbreak — scoring, deals & completion", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	/** Bids, jumps to the final trick, and plays it — finishing the active deal. */
	async function finishDeal(
		engine: Engine,
		bids: Record<string, number>,
		wins: Record<string, number>,
		cards: Record<string, CardId>
	) {
		await declareAll( memory, engine, bids );
		primeFinalTrick( memory, wins, cards );
		for ( let i = 0; i < 4; i++ ) {
			await play( memory, engine, cards[ stored( memory ).context.currentPlayer ]! );
		}
	}

	// p3 takes the thirteenth trick with the only trump.
	const LAST_TRICK: Record<string, CardId> = { p1: "5H", p2: "9H", p3: "2S", p4: "3D" };
	const BIDS = { p1: 2, p2: 3, p3: 5, p4: 4 };
	const WINS_SO_FAR = { p1: 4, p2: 4, p3: 2, p4: 2 };

	test( "a finished deal is scored: bid made, overtricks paid, shortfall penalised",
		async () => {
			const engine = await boot( memory, { config: { dealCount: 5 } } );
			await finishDeal( engine, BIDS, WINS_SO_FAR, LAST_TRICK );

			// Wins after the final trick: p1 4, p2 4, p3 3, p4 2.
			// p1 bid 2, took 4 → 20 + 2 overtricks. p2 bid 3, took 4 → 30 + 1 overtrick.
			// p3 bid 5, took 3 → the whole bid is forfeit. p4 bid 4, took 2 → likewise.
			const scored = stored( memory ).state.deals[ 1 ]!;
			expect( scored.wins ).toEqual( { p1: 4, p2: 4, p3: 3, p4: 2 } );
			expect( scored.scores ).toEqual( { p1: 24, p2: 32, p3: -50, p4: -40 } );

			const state = await run( memory, engine.getState( P1.id ) );
			expect( state.view.scores ).toEqual( scoreTable( { p1: 24, p2: 32, p3: -50, p4: -40 } ) );
		} );

	test( "finishing a deal below the deal count opens the next one, one seat along",
		async () => {
			const engine = await boot( memory, { config: { dealCount: 5 } } );
			await finishDeal( engine, BIDS, WINS_SO_FAR, LAST_TRICK );

			const state = await run( memory, engine.getState( P1.id ) );
			expect( state.status ).toBe( "IN_PROGRESS" );
			expect( state.context.phase ).toBe( "DECLARING" );

			// A fresh deal, dealt in full, with the lead passed on from p1 to p2.
			const next = activeDeal( memory );
			expect( next.startingPlayer ).toBe( P2.id );
			expect( next.declarations ).toEqual( { p1: 0, p2: 0, p3: 0, p4: 0 } );
			expect( SEATED.map( ( p ) => next.hands[ p.id ]!.length ) ).toEqual( [ 13, 13, 13, 13 ] );
			expect( state.context.currentPlayer ).toBe( P2.id );
		} );

	test( "scores accumulate across deals and the last one completes the game", async () => {
		const engine = await boot( memory, { config: { dealCount: 2 } } );
		await finishDeal( engine, BIDS, WINS_SO_FAR, LAST_TRICK );
		expect( stored( memory ).status ).toBe( "IN_PROGRESS" );

		await finishDeal( engine, BIDS, WINS_SO_FAR, LAST_TRICK );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		// Two identical deals, so every total is exactly doubled.
		expect( state.view.scores ).toEqual( scoreTable( { p1: 48, p2: 64, p3: -100, p4: -80 } ) );
	} );

	test( "completing the game names the highest cumulative score as the winner", async () => {
		const engine = await boot( memory, { config: { dealCount: 1 } } );
		await finishDeal( engine, BIDS, WINS_SO_FAR, LAST_TRICK );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( P2.id );
	} );

	test( "a completed game accepts no further moves (GameNotInProgress)", async () => {
		const engine = await boot( memory, { config: { dealCount: 1 } } );
		await finishDeal( engine, BIDS, WINS_SO_FAR, LAST_TRICK );

		const error = await runFail( memory, engine.declareWins(
			{ wins: 2, dealId: dealId( memory ) },
			P1
		) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );
} );

// ===========================================================================
describe( "callbreak — log & time travel", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "the action feed is empty — callbreak declares no describe", async () => {
		const engine = await bootPlaying( memory );
		expect( await run( memory, engine.getLog( P1.id ) ) ).toEqual( [] );
	} );

	test( "undo rewinds a declaration and hands the turn back", async () => {
		const engine = await boot( memory );
		await run( memory, engine.declareWins( { wins: 4, dealId: dealId( memory ) }, P1 ) );
		expect( activeDeal( memory ).declarations[ P1.id ] ).toBe( 4 );

		await run( memory, engine.undo( P1 ) );

		expect( activeDeal( memory ).declarations[ P1.id ] ).toBe( 0 );
		expect( stored( memory ).context.currentPlayer ).toBe( P1.id );
	} );

	test( "redo replays the undone declaration", async () => {
		const engine = await boot( memory );
		await run( memory, engine.declareWins( { wins: 4, dealId: dealId( memory ) }, P1 ) );
		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.redo( P1 ) );

		expect( activeDeal( memory ).declarations[ P1.id ] ).toBe( 4 );
		expect( stored( memory ).context.currentPlayer ).toBe( P2.id );
	} );

	test( "undo rewinds a played card back onto its owner's hand", async () => {
		const engine = await bootPlaying( memory );
		const hand = [ ...activeDeal( memory ).hands[ P1.id ]! ];
		await play( memory, engine, hand[ 0 ]! );
		expect( activeDeal( memory ).hands[ P1.id ] ).toHaveLength( 12 );

		await run( memory, engine.undo( P1 ) );

		expect( activeDeal( memory ).hands[ P1.id ] ).toEqual( hand );
		expect( activeDeal( memory ).tricks[ 0 ]!.cards ).toEqual( {} );
		expect( stored( memory ).context.currentPlayer ).toBe( P1.id );
	} );

	test( "undoing back past the start rewinds the whole deal", async () => {
		const engine = await boot( memory );
		await run( memory, engine.undo( P1 ) );

		const state = stored( memory );
		expect( state.status ).toBe( "PLAYERS_READY" );
		expect( state.state.deals ).toEqual( [] );
		expect( state.context.phase ).toBeUndefined();
	} );

	test( "a new declaration after an undo drops the redo tail (NothingToRedo)", async () => {
		const engine = await boot( memory );
		const id = dealId( memory );
		await run( memory, engine.declareWins( { wins: 4, dealId: id }, P1 ) );
		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.declareWins( { wins: 2, dealId: id }, P1 ) );

		expect( ( await runFail( memory, engine.redo( P1 ) ) )._tag ).toBe( "swish/NothingToRedo" );
		expect( activeDeal( memory ).declarations[ P1.id ] ).toBe( 2 );
	} );
} );
