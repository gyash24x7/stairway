import { beforeEach, describe, expect, test } from "bun:test";

import { splendor } from "@/games/splendor/server/engine.ts";
import { DEFAULT_TOKENS } from "@/games/splendor/server/utils.ts";
import type {
	Card,
	Cost,
	Noble,
	PlayerData,
	SplendorConfig,
	SplendorPlayerView,
	SplendorState,
	SplendorTableView,
	SplendorView,
	Tokens
} from "@/games/splendor/shared/schema.ts";
import { GameCode, GameId, type PlayerId } from "@/shared/swish/schema.ts";
import { makeMemory, type Memory, player, run, runFail } from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

const P1 = player( "p1" );
const P2 = player( "p2" );
const P3 = player( "p3" );
const P4 = player( "p4" );
/** Never joins anything — used to prove `assertMember` gates each command. */
const STRANGER = player( "p9" );
const BOT = player( "bot", true );

const CONFIG: SplendorConfig = { playerCount: 2, autoStart: false, winningPoints: 15 };

// --- Fixtures --------------------------------------------------------------

/** A full token map; every gem defaults to zero. */
const tokens = ( over: Partial<Tokens> = {} ) => ( { ...DEFAULT_TOKENS, ...over } );

/** A full cost map; every gem defaults to zero. */
const cost = ( over: Partial<Cost> = {} ) =>
	( { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, ...over } );

/** A card with sane defaults — override only what a test cares about. */
const card = ( id: string, over: Partial<Card> = {} ) => {
	const base: Card = { id, level: 1, points: 0, cost: cost(), bonus: "diamond" };
	return { ...base, ...over };
};

/** A noble whose requirement is the given (partial) cost. */
const noble = ( id: string, over: Partial<Cost> = {} ) => {
	const result: Noble = { id, points: 3, cost: cost( over ) };
	return result;
};

// --- Store access ----------------------------------------------------------

/**
 * The snapshot the fake `GameStore` holds. The decks are deliberately absent from
 * every view, so the only way to assert on them is through the store itself.
 */
const persisted = ( memory: Memory ) => memory.store.value as {
	status: string;
	state: SplendorState;
	context: { turn: number; currentPlayer: PlayerId };
};

/** Overwrite fields of the stored board, staging a position real play would take many turns to reach. */
const patchState = ( memory: Memory, patch: Partial<SplendorState> ) => {
	const snap = memory.store.value as { state: SplendorState };
	memory.store.value = { ...snap, state: { ...snap.state, ...patch } };
};

/** Overwrite fields of one player's slice (tokens, owned cards, reserves, points). */
const patchPlayer = ( memory: Memory, id: PlayerId, patch: Partial<PlayerData> ) => {
	const { state } = persisted( memory );
	patchState( memory, {
		playerData: { ...state.playerData, [ id ]: { ...state.playerData[ id ]!, ...patch } }
	} );
};

/** The table + per-player payload of the most recent broadcast. */
const lastBroadcast = ( memory: Memory ) => memory.broadcasts.at( -1 )! as {
	channel: string;
	snapshot: {
		table: { view: SplendorTableView };
		playerViews: Record<string, { view: SplendorPlayerView }>;
	};
};

/** Narrows a snapshot's audience-parameterised view to the player variant. */
const asPlayerView = ( view: SplendorView ) => view as SplendorPlayerView;

/** initialize → join every player → (optionally) start a splendor game. */
async function bootSplendor(
	memory: Memory,
	opts: {
		config?: Partial<SplendorConfig>;
		players?: ReturnType<typeof player>[];
		start?: boolean;
		seed?: string;
	} = {}
) {
	const engine = await run( memory, splendor );
	const players = opts.players ?? [ P1, P2 ];
	// The roster drives the seat count; the schema pins it to the game's legal
	// set, so narrow the derived length to it.
	const config = {
		...CONFIG,
		playerCount: players.length as SplendorConfig[ "playerCount" ],
		...opts.config
	};

	await run( memory, engine.initialize( {
		id: GID, code: CODE, config, seed: opts.seed ?? "seed"
	} ) );
	for ( const p of players ) {
		await run( memory, engine.join( p ) );
	}

	if ( opts.start !== false ) {
		await run( memory, engine.start( players[ 0 ]!.id ) );
	}

	return engine;
}

// ===========================================================================
describe( "splendor — setup & deal", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "initialize builds the full 40/30/20 deck with nothing on the table yet", async () => {
		const engine = await run( memory, splendor );
		await run( memory, engine.initialize( {
			id: GID, code: CODE, config: CONFIG, seed: "seed"
		} ) );

		const { state, status } = persisted( memory );
		expect( status ).toBe( "CREATED" );
		expect( state.decks[ 1 ] ).toHaveLength( 40 );
		expect( state.decks[ 2 ] ).toHaveLength( 30 );
		expect( state.decks[ 3 ] ).toHaveLength( 20 );
		// `setup` only shuffles the decks — the board is dealt by `onStart`.
		expect( state.cards ).toEqual( { 1: [], 2: [], 3: [] } );
		expect( state.nobles ).toHaveLength( 0 );
		expect( state.tokens ).toEqual( tokens() );
		expect( state.playerData ).toEqual( {} );
	} );

	test( "each join seeds that player's empty slice", async () => {
		await bootSplendor( memory, { start: false } );

		const { state } = persisted( memory );
		expect( Object.keys( state.playerData ).sort() ).toEqual( [ "p1", "p2" ] );
		expect( state.playerData[ P1.id ] ).toEqual( {
			tokens: tokens(), cards: [], nobles: [], reserved: [], points: 0
		} );
	} );

	test( "start deals four cards per level off the top of each deck", async () => {
		const engine = await run( memory, splendor );
		await run( memory, engine.initialize( {
			id: GID, code: CODE, config: CONFIG, seed: "seed"
		} ) );

		const before = persisted( memory ).state.decks;
		const tops = {
			1: before[ 1 ].slice( 0, 4 ).map( c => c.id ),
			2: before[ 2 ].slice( 0, 4 ).map( c => c.id ),
			3: before[ 3 ].slice( 0, 4 ).map( c => c.id )
		};

		await run( memory, engine.join( P1 ) );
		await run( memory, engine.join( P2 ) );
		await run( memory, engine.start( P1.id ) );

		const { state } = persisted( memory );
		for ( const level of [ 1, 2, 3 ] as const ) {
			expect( state.cards[ level ].map( c => c.id ) ).toEqual( tops[ level ] );
		}

		expect( state.decks[ 1 ] ).toHaveLength( 36 );
		expect( state.decks[ 2 ] ).toHaveLength( 26 );
		expect( state.decks[ 3 ] ).toHaveLength( 16 );
	} );

	test( "a 2- or 3-player table gets 5 gem tokens; a 4-player table gets 7", async () => {
		await bootSplendor( memory, { players: [ P1, P2 ] } );
		expect( persisted( memory ).state.tokens ).toEqual( tokens( {
			diamond: 5, sapphire: 5, emerald: 5, ruby: 5, onyx: 5, gold: 5
		} ) );

		const three = makeMemory();
		await bootSplendor( three, { players: [ P1, P2, P3 ] } );
		expect( persisted( three ).state.tokens.diamond ).toBe( 5 );

		const four = makeMemory();
		await bootSplendor( four, { players: [ P1, P2, P3, P4 ] } );
		// Only the gem piles scale — gold is always five.
		expect( persisted( four ).state.tokens ).toEqual( tokens( {
			diamond: 7, sapphire: 7, emerald: 7, ruby: 7, onyx: 7, gold: 5
		} ) );
	} );

	test( "the noble row is always one longer than the table", async () => {
		for ( const seats of [ [ P1, P2 ], [ P1, P2, P3 ], [ P1, P2, P3, P4 ] ] ) {
			const table = makeMemory();
			await bootSplendor( table, { players: seats } );
			expect( persisted( table ).state.nobles ).toHaveLength( seats.length + 1 );
		}
	} );

	test( "the first player to join opens the game", async () => {
		const engine = await bootSplendor( memory );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.currentPlayer ).toBe( P1.id );
		expect( state.context.turn ).toBe( 0 );
	} );
} );

// ===========================================================================
describe( "splendor — determinism & replay", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "folding the same log always reproduces the same board", async () => {
		const engine = await bootSplendor( memory );
		// The deal is captured inside `GameDealt`, so replaying the log rebuilds it.
		const dealt = persisted( memory ).state;

		await run( memory, engine.pickTokens(
			{ tokens: { diamond: 1, sapphire: 1, emerald: 1 } },
			P1
		) );
		await run( memory, engine.pickTokens(
			{ tokens: { ruby: 1, onyx: 1, diamond: 1 } },
			P2
		) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 2 } }, P1 ) );
		const played = persisted( memory ).state;

		// Rewind every move commit — the genesis snapshot refolds to the deal...
		for ( let i = 0; i < 3; i++ ) {
			await run( memory, engine.undo( P1 ) );
		}
		expect( persisted( memory ).state ).toEqual( dealt );

		// ...and replaying them lands on exactly the same board again.
		for ( let i = 0; i < 3; i++ ) {
			await run( memory, engine.redo( P1 ) );
		}
		expect( persisted( memory ).state ).toEqual( played );
	} );

	// `generateDecks`/`generateNobles` draw from the engine's seeded `rng`, so the
	// seed fixes both the shuffled decks and the noble row.
	test( "a fixed seed always deals the same board", async () => {
		const a = makeMemory();
		const b = makeMemory();
		await bootSplendor( a );
		await bootSplendor( b );

		expect( persisted( a ).state.cards ).toEqual( persisted( b ).state.cards );
		expect( persisted( a ).state.nobles ).toEqual( persisted( b ).state.nobles );

		// ...and a different seed deals a different board, so the assertions above
		// are about the seed rather than a constant.
		const c = makeMemory();
		await bootSplendor( c, { seed: "another-seed" } );
		expect( persisted( c ).state.cards ).not.toEqual( persisted( a ).state.cards );
	} );
} );

// ===========================================================================
describe( "splendor — pickTokens validation", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "gold can never be taken directly", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail( memory, engine.pickTokens( { tokens: { gold: 1 } }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a depleted pile cannot be drawn from", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, { tokens: tokens( { diamond: 5, sapphire: 5, ruby: 5, gold: 5 } ) } );

		const error = await runFail( memory, engine.pickTokens( { tokens: { onyx: 1 } }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "no more than two of a single type may be taken", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail( memory, engine.pickTokens( { tokens: { diamond: 3 } }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "taking two of a type needs four left in the pile", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, { tokens: tokens( {
			diamond: 3, sapphire: 5, emerald: 5, ruby: 5, onyx: 5, gold: 5
		} ) } );

		const error = await runFail( memory, engine.pickTokens( { tokens: { diamond: 2 } }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "two different types must be one each", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail(
			memory,
			engine.pickTokens( { tokens: { diamond: 2, sapphire: 1 } }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "three different types must be one each", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail(
			memory,
			engine.pickTokens( { tokens: { diamond: 2, sapphire: 1, emerald: 1 } }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "picking nothing, or four types, is not a legal shape", async () => {
		const engine = await bootSplendor( memory );

		expect( ( await runFail( memory, engine.pickTokens( { tokens: {} }, P1 ) ) )._tag )
			.toBe( "swish/InvalidMove" );

		const four = { diamond: 1, sapphire: 1, emerald: 1, ruby: 1 };
		expect( ( await runFail( memory, engine.pickTokens( { tokens: four }, P1 ) ) )._tag )
			.toBe( "swish/InvalidMove" );
	} );

	test( "tokens may not be returned when the hold limit is not exceeded", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail( memory, engine.pickTokens(
			{ tokens: { diamond: 1 }, returned: { diamond: 1 } },
			P1
		) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "crossing the ten-token limit demands exactly the overflow back", async () => {
		const engine = await bootSplendor( memory );
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 5, sapphire: 4 } ) } );

		// 9 held + 3 picked = 12, so exactly 2 must come back — not 1.
		const error = await runFail( memory, engine.pickTokens(
			{ tokens: { emerald: 1, ruby: 1, onyx: 1 }, returned: { diamond: 1 } },
			P1
		) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a player cannot return tokens they will not hold", async () => {
		const engine = await bootSplendor( memory );
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 5, sapphire: 4 } ) } );

		const error = await runFail( memory, engine.pickTokens(
			{ tokens: { emerald: 1, ruby: 1, onyx: 1 }, returned: { gold: 2 } },
			P1
		) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "only the current player may pick", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P2 ) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "no move lands before the game starts", async () => {
		const engine = await bootSplendor( memory, { start: false } );
		const error = await runFail( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );
} );

// ===========================================================================
describe( "splendor — pickTokens economics", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "three different tokens move from the board to the player, and the turn passes", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens(
			{ tokens: { diamond: 1, sapphire: 1, emerald: 1 } },
			P1
		) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.tokens )
			.toEqual( tokens( { diamond: 1, sapphire: 1, emerald: 1 } ) );
		expect( state.view.tokens ).toEqual( tokens( {
			diamond: 4, sapphire: 4, emerald: 4, ruby: 5, onyx: 5, gold: 5
		} ) );
		expect( state.context.turn ).toBe( 1 );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );

	test( "two different tokens is a legal pick", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { diamond: 1, onyx: 1 } }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.tokens )
			.toEqual( tokens( { diamond: 1, onyx: 1 } ) );
		expect( state.view.tokens.diamond ).toBe( 4 );
		expect( state.view.tokens.onyx ).toBe( 4 );
	} );

	test( "two of a type is legal when four remain in the pile", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { ruby: 2 } }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.tokens.ruby ).toBe( 2 );
		expect( state.view.tokens.ruby ).toBe( 3 );
	} );

	test( "the overflow is handed straight back to the board", async () => {
		const engine = await bootSplendor( memory );
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 5, sapphire: 4 } ) } );

		await run( memory, engine.pickTokens(
			{ tokens: { emerald: 1, ruby: 1, onyx: 1 }, returned: { diamond: 2 } },
			P1
		) );

		const state = await run( memory, engine.getState( P1.id ) );
		const hand = state.view.playerData[ P1.id ]!.tokens;
		expect( hand ).toEqual( tokens( {
			diamond: 3, sapphire: 4, emerald: 1, ruby: 1, onyx: 1
		} ) );
		// The hold limit is exactly ten.
		expect( Object.values( hand ).reduce( ( a, b ) => a + b, 0 ) ).toBe( 10 );
		expect( state.view.tokens ).toEqual( tokens( {
			diamond: 7, sapphire: 5, emerald: 4, ruby: 4, onyx: 4, gold: 5
		} ) );
	} );
} );

// ===========================================================================
describe( "splendor — reserveCard", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "an unknown card cannot be reserved", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail(
			memory,
			engine.reserveCard( { cardId: "nope", withGold: false }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a fourth reserve is refused", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchPlayer( memory, P1.id, {
			reserved: [ card( "r1" ), card( "r2" ), card( "r3" ) ]
		} );

		const error = await runFail(
			memory,
			engine.reserveCard( { cardId: open.id, withGold: false }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "no gold left means no gold taken", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchState( memory, { tokens: tokens( {
			diamond: 5, sapphire: 5, emerald: 5, ruby: 5, onyx: 5, gold: 0
		} ) } );

		const error = await runFail(
			memory,
			engine.reserveCard( { cardId: open.id, withGold: true }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "taking gold at the hold limit requires handing a token back", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 5, sapphire: 5 } ) } );

		const error = await runFail(
			memory,
			engine.reserveCard( { cardId: open.id, withGold: true }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a token may not be handed back when the limit is not reached", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 1 } ) } );

		const error = await runFail(
			memory,
			engine.reserveCard( { cardId: open.id, withGold: true, returnedToken: "diamond" }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a token the player does not hold cannot be handed back", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 5, sapphire: 5 } ) } );

		const error = await runFail(
			memory,
			engine.reserveCard( { cardId: open.id, withGold: true, returnedToken: "onyx" }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "reserving with gold takes the card, refills the row, and pays a gold", async () => {
		const engine = await bootSplendor( memory );
		const board = persisted( memory ).state;
		const open = board.cards[ 1 ][ 0 ]!;
		const next = board.decks[ 1 ][ 0 ]!;

		await run( memory, engine.reserveCard( { cardId: open.id, withGold: true }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.reserved.map( c => c.id ) ).toEqual( [ open.id ] );
		expect( state.view.playerData[ P1.id ]!.tokens.gold ).toBe( 1 );
		expect( state.view.tokens.gold ).toBe( 4 );
		// The vacated slot is refilled from the top of that level's deck.
		expect( state.view.cards[ 1 ] ).toHaveLength( 4 );
		expect( state.view.cards[ 1 ][ 0 ]!.id ).toBe( next.id );
		expect( persisted( memory ).state.decks[ 1 ] ).toHaveLength( 35 );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );

	test( "an exhausted deck leaves the slot empty rather than refilled", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchState( memory, {
			decks: { ...persisted( memory ).state.decks, 1: [] }
		} );

		await run( memory, engine.reserveCard( { cardId: open.id, withGold: false }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.cards[ 1 ] ).toHaveLength( 3 );
		expect( state.view.cards[ 1 ].some( c => c.id === open.id ) ).toBe( false );
		// No gold was taken, so the bank is untouched.
		expect( state.view.tokens.gold ).toBe( 5 );
	} );

	test( "handing a token back at the limit keeps the hand at ten", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 5, sapphire: 5 } ) } );

		await run( memory, engine.reserveCard(
			{ cardId: open.id, withGold: true, returnedToken: "diamond" },
			P1
		) );

		const hand = ( await run( memory, engine.getState( P1.id ) ) )
			.view.playerData[ P1.id ]!.tokens;
		expect( hand ).toEqual( tokens( { diamond: 4, sapphire: 5, gold: 1 } ) );
		expect( Object.values( hand ).reduce( ( a, b ) => a + b, 0 ) ).toBe( 10 );
	} );
} );

// ===========================================================================
describe( "splendor — purchaseCard validation", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "an unknown card cannot be bought", async () => {
		const engine = await bootSplendor( memory );
		const error = await runFail(
			memory,
			engine.purchaseCard( { cardId: "nope", payment: {} }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "paying more of a gem than the card costs is refused", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, {
			cards: { ...persisted( memory ).state.cards, 1: [ card( "t", {
				cost: cost( { diamond: 1 } )
			} ) ] }
		} );
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 5 } ) } );

		const error = await runFail(
			memory,
			engine.purchaseCard( { cardId: "t", payment: { diamond: 2 } }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "an unfunded shortfall is refused", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, {
			cards: { ...persisted( memory ).state.cards, 1: [ card( "t", {
				cost: cost( { diamond: 2 } )
			} ) ] }
		} );
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 1, gold: 5 } ) } );

		// One diamond short and no gold offered to cover it.
		const error = await runFail(
			memory,
			engine.purchaseCard( { cardId: "t", payment: { diamond: 1 } }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "offering more gold than the shortfall is refused", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, {
			cards: { ...persisted( memory ).state.cards, 1: [ card( "t", {
				cost: cost( { diamond: 2 } )
			} ) ] }
		} );
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 2, gold: 5 } ) } );

		const error = await runFail(
			memory,
			engine.purchaseCard( { cardId: "t", payment: { diamond: 2, gold: 1 } }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a payment the player cannot cover is refused", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, {
			cards: { ...persisted( memory ).state.cards, 1: [ card( "t", {
				cost: cost( { diamond: 2 } )
			} ) ] }
		} );

		// The payment matches the cost exactly — the player just has no tokens.
		const error = await runFail(
			memory,
			engine.purchaseCard( { cardId: "t", payment: { diamond: 2 } }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );
} );

// ===========================================================================
describe( "splendor — purchaseCard economics", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "buying an open card pays the bank, banks the card, and refills the row", async () => {
		const engine = await bootSplendor( memory );
		const board = persisted( memory ).state;
		const target = board.cards[ 1 ][ 0 ]!;
		const next = board.decks[ 1 ][ 0 ]!;
		patchPlayer( memory, P1.id, { tokens: tokens( target.cost ) } );

		await run( memory, engine.purchaseCard(
			{ cardId: target.id, payment: target.cost },
			P1
		) );

		const state = await run( memory, engine.getState( P1.id ) );
		const me = state.view.playerData[ P1.id ]!;
		expect( me.cards.map( c => c.id ) ).toEqual( [ target.id ] );
		expect( me.points ).toBe( target.points );
		expect( me.tokens ).toEqual( tokens() );
		// Every token spent goes back to the bank.
		for ( const gem of [ "diamond", "sapphire", "emerald", "ruby", "onyx" ] as const ) {
			expect( state.view.tokens[ gem ] ).toBe( 5 + target.cost[ gem ] );
		}

		expect( state.view.cards[ 1 ][ 0 ]!.id ).toBe( next.id );
		expect( persisted( memory ).state.decks[ 1 ] ).toHaveLength( 35 );
	} );

	test( "gold stands in for the gems a player is short of", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, {
			cards: { ...persisted( memory ).state.cards, 1: [ card( "t", {
				cost: cost( { diamond: 2, onyx: 1 } )
			} ) ] }
		} );
		patchPlayer( memory, P1.id, { tokens: tokens( { diamond: 1, gold: 2 } ) } );

		await run( memory, engine.purchaseCard(
			{ cardId: "t", payment: { diamond: 1, gold: 2 } },
			P1
		) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.tokens ).toEqual( tokens() );
		// The two jokers return to the bank as gold, not as the gems they covered.
		expect( state.view.tokens.gold ).toBe( 7 );
		expect( state.view.tokens.diamond ).toBe( 6 );
		expect( state.view.tokens.onyx ).toBe( 5 );
	} );

	test( "owned cards discount the price, gem by gem", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, {
			cards: { ...persisted( memory ).state.cards, 1: [ card( "t", {
				cost: cost( { diamond: 2, onyx: 1 } )
			} ) ] }
		} );
		patchPlayer( memory, P1.id, {
			tokens: tokens( { onyx: 1 } ),
			cards: [ card( "d1" ), card( "d2" ) ]
		} );

		// Two diamond bonuses wipe out the diamond cost entirely...
		const error = await runFail(
			memory,
			engine.purchaseCard( { cardId: "t", payment: { diamond: 1, onyx: 1 } }, P1 )
		);
		expect( error._tag ).toBe( "swish/InvalidMove" );

		// ...so the onyx alone buys the card.
		await run( memory, engine.purchaseCard( { cardId: "t", payment: { onyx: 1 } }, P1 ) );
		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.cards.map( c => c.id ) )
			.toEqual( [ "d1", "d2", "t" ] );
		expect( state.view.playerData[ P1.id ]!.tokens ).toEqual( tokens() );
	} );

	test( "a qualifying purchase pulls a noble off the row for three points", async () => {
		const engine = await bootSplendor( memory );
		patchState( memory, {
			cards: { ...persisted( memory ).state.cards, 1: [ card( "t", { points: 1 } ) ] },
			nobles: [ noble( "n1", { diamond: 3 } ), noble( "n2", { onyx: 4 } ) ]
		} );
		patchPlayer( memory, P1.id, { cards: [ card( "d1" ), card( "d2" ) ] } );

		// The third diamond bonus is what summons the noble.
		await run( memory, engine.purchaseCard( { cardId: "t", payment: {} }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		const me = state.view.playerData[ P1.id ]!;
		expect( me.nobles.map( n => n.id ) ).toEqual( [ "n1" ] );
		expect( me.points ).toBe( 4 );
		expect( state.view.nobles.map( n => n.id ) ).toEqual( [ "n2" ] );
	} );

	test( "buying out of reserve consumes the reserve and leaves the row alone", async () => {
		const engine = await bootSplendor( memory );
		const openBefore = persisted( memory ).state.cards[ 1 ].map( c => c.id );
		patchPlayer( memory, P1.id, {
			tokens: tokens( { ruby: 1 } ),
			reserved: [ card( "held", { cost: cost( { ruby: 1 } ), points: 2 } ) ]
		} );

		await run( memory, engine.purchaseCard(
			{ cardId: "held", payment: { ruby: 1 } },
			P1
		) );

		const state = await run( memory, engine.getState( P1.id ) );
		const me = state.view.playerData[ P1.id ]!;
		expect( me.reserved ).toHaveLength( 0 );
		expect( me.cards.map( c => c.id ) ).toEqual( [ "held" ] );
		expect( me.points ).toBe( 2 );
		expect( state.view.cards[ 1 ].map( c => c.id ) ).toEqual( openBefore );
		expect( persisted( memory ).state.decks[ 1 ] ).toHaveLength( 36 );
	} );
} );

// ===========================================================================
describe( "splendor — view redaction & broadcast", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a player audience sees the board plus their own identity — never the decks", async () => {
		const engine = await bootSplendor( memory );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.view._tag ).toBe( "splendor/PlayerView" );
		expect( asPlayerView( state.view ).playerId ).toBe( P1.id );
		expect( Object.keys( state.view ).sort() )
			.toEqual( [ "_tag", "cards", "nobles", "playerData", "playerId", "tokens" ] );
		// The undealt decks are the game's only hidden state, and they stay hidden.
		expect( state.view ).not.toHaveProperty( "decks" );
		expect( persisted( memory ).state.decks[ 1 ] ).toHaveLength( 36 );
	} );

	test( "the table projection is the same board minus any player identity", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );

		const { table, playerViews } = lastBroadcast( memory ).snapshot;
		expect( table.view._tag ).toBe( "splendor/TableView" );
		expect( Object.keys( table.view ).sort() )
			.toEqual( [ "_tag", "cards", "nobles", "playerData", "tokens" ] );
		expect( table.view ).not.toHaveProperty( "decks" );
		expect( table.view ).not.toHaveProperty( "playerId" );

		// Both audiences see one identical public board; only the tag and the
		// viewer's own id differ.
		const { _tag: _p, playerId: _id, ...forP1 } = playerViews[ P1.id ]!.view;
		const { _tag: _t, ...forTable } = table.view;
		expect( forP1 ).toEqual( forTable );
	} );

	test( "each commit broadcasts a table + per-player snapshot on the game channel", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );

		const last = lastBroadcast( memory );
		expect( last.channel ).toBe( "splendor:g1" );
		expect( Object.keys( last.snapshot.playerViews ).sort() ).toEqual( [ "p1", "p2" ] );
		expect( last.snapshot.playerViews[ P2.id ]!.view.playerId ).toBe( P2.id );
	} );

	test( "reserved cards are public — a card can only ever be reserved face-up", async () => {
		const engine = await bootSplendor( memory );
		const open = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		await run( memory, engine.reserveCard( { cardId: open.id, withGold: false }, P1 ) );

		// `reserveCard` only accepts an id from the open rows (there is no
		// reserve-from-deck move), so every opponent already watched this card
		// leave the tableau — nothing is being leaked by showing it.
		const forP2 = await run( memory, engine.getState( P2.id ) );
		expect( forP2.view.playerData[ P1.id ]!.reserved.map( c => c.id ) ).toEqual( [ open.id ] );
		expect( lastBroadcast( memory ).snapshot.table.view.playerData[ P1.id ]!.reserved )
			.toHaveLength( 1 );
	} );

	test( "a non-member can read neither the board nor the action feed", async () => {
		const engine = await bootSplendor( memory );

		expect( ( await runFail( memory, engine.getState( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
		expect( ( await runFail( memory, engine.getLog( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
	} );

	test( "the action feed is empty — splendor declares no describe", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );

		expect( await run( memory, engine.getLog( P1.id ) ) ).toEqual( [] );
	} );
} );

// ===========================================================================
describe( "splendor — completion & scoring", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	/** Stages a one-point card p1 can buy for free, with `winningPoints` set to one. */
	const stageWinningCard = ( mem: Memory ) => patchState( mem, {
		cards: { ...persisted( mem ).state.cards, 1: [ card( "win", { points: 1 } ) ] }
	} );

	test( "the game only ends once the round completes", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 1 } } );
		stageWinningCard( memory );

		await run( memory, engine.purchaseCard( { cardId: "win", payment: {} }, P1 ) );

		// p1 is over the threshold, but p2 still owes a turn.
		const midRound = await run( memory, engine.getState( P1.id ) );
		expect( midRound.status ).toBe( "IN_PROGRESS" );
		expect( midRound.view.playerData[ P1.id ]!.points ).toBe( 1 );
		expect( midRound.context.turn ).toBe( 1 );

		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );

		const final = await run( memory, engine.getState( P1.id ) );
		expect( final.status ).toBe( "COMPLETED" );
		expect( final.context.turn ).toBe( 2 );
		expect( final.view.winner ).toBe( P1.id );
	} );

	test( "a completed game accepts no further moves", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 1 } } );
		stageWinningCard( memory );
		await run( memory, engine.purchaseCard( { cardId: "win", payment: {} }, P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );

		const error = await runFail( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "the highest scorer wins", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		patchPlayer( memory, P1.id, { points: 3 } );
		patchPlayer( memory, P2.id, { points: 7 } );

		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( P2.id );
	} );

	test( "a tie on points goes to the fewest development cards", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		// p1 needed four cards to reach five points; p2 got there on two, so the
		// later seat takes it despite the fold starting from the earlier one.
		patchPlayer( memory, P1.id, {
			points: 5,
			cards: [ card( "a" ), card( "b" ), card( "c" ), card( "d" ) ]
		} );
		patchPlayer( memory, P2.id, { points: 5, cards: [ card( "e" ), card( "f" ) ] } );

		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( P2.id );
	} );

	test( "nobles and reserved cards do not count toward the card tie-break", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		// Both bought two cards. p1 also holds a noble and three reserves — none
		// of which are development cards, so the tie stands and the seat decides.
		patchPlayer( memory, P1.id, {
			points: 5,
			cards: [ card( "a" ), card( "b" ) ],
			nobles: [ noble( "n1" ) ],
			reserved: [ card( "r1" ), card( "r2" ), card( "r3" ) ]
		} );
		patchPlayer( memory, P2.id, { points: 5, cards: [ card( "c" ), card( "d" ) ] } );

		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );

		expect( ( await run( memory, engine.getState( P1.id ) ) ).view.winner ).toBe( P1.id );
	} );

	test( "a tie on points and cards resolves to the earlier seat", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		patchPlayer( memory, P1.id, { points: 5, cards: [ card( "a" ) ] } );
		patchPlayer( memory, P2.id, { points: 5, cards: [ card( "b" ) ] } );

		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		// The sort is stable, so a dead-even draw keeps the seating order.
		expect( state.view.winner ).toBe( P1.id );
	} );

	test( "the card tie-break never overrides a points lead", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		// p2 owns fewer cards but is a point behind — points come first.
		patchPlayer( memory, P1.id, {
			points: 6,
			cards: [ card( "a" ), card( "b" ), card( "c" ) ]
		} );
		patchPlayer( memory, P2.id, { points: 5, cards: [ card( "d" ) ] } );

		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );

		expect( ( await run( memory, engine.getState( P1.id ) ) ).view.winner ).toBe( P1.id );
	} );

	test( "turns rotate round-robin through the seating order", async () => {
		const engine = await bootSplendor( memory, { players: [ P1, P2, P3 ] } );

		for ( const [ actor, next ] of [ [ P1, P2 ], [ P2, P3 ], [ P3, P1 ] ] as const ) {
			await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, actor ) );
			expect( ( await run( memory, engine.getState( P1.id ) ) ).context.currentPlayer )
				.toBe( next.id );
		}
	} );
} );

// ===========================================================================
describe( "splendor — resolveResults", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	/** Ends the round both seats are mid-way through, completing the game. */
	const closeRound = async ( engine: Awaited<ReturnType<typeof bootSplendor>> ) => {
		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 1 } }, P2 ) );
		return run( memory, engine.getState( P1.id ) );
	};

	test( "ranks by prestige points and carries each seat's score", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		patchPlayer( memory, P1.id, { points: 3 } );
		patchPlayer( memory, P2.id, { points: 7 } );

		const state = await closeRound( engine );
		expect( state.results ).toEqual( {
			winner: P2.id,
			ranking: [
				{ playerId: P2.id, rank: 1, score: 7 },
				{ playerId: P1.id, rank: 2, score: 3 }
			]
		} );
	} );

	test( "the fewest-cards tie-break decides the ranking, not just the winner", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		patchPlayer( memory, P1.id, {
			points: 5,
			cards: [ card( "a" ), card( "b" ), card( "c" ), card( "d" ) ]
		} );
		patchPlayer( memory, P2.id, { points: 5, cards: [ card( "e" ), card( "f" ) ] } );

		const state = await closeRound( engine );
		expect( state.results?.winner ).toBe( P2.id );
		expect( state.results?.ranking.map( ( r ) => r.playerId ) ).toEqual( [ P2.id, P1.id ] );
		expect( state.results?.ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 2 ] );
	} );

	test( "seats level on points and cards share rank 1 with no outright winner", async () => {
		const engine = await bootSplendor( memory, { config: { winningPoints: 3 } } );
		patchPlayer( memory, P1.id, { points: 5, cards: [ card( "a" ) ] } );
		patchPlayer( memory, P2.id, { points: 5, cards: [ card( "b" ) ] } );

		const state = await closeRound( engine );
		// `view.winner` still names the top seat (the fold is stable), but the
		// standings refuse to crown a winner nobody actually out-ranked.
		expect( state.view.winner ).toBe( P1.id );
		expect( state.results?.winner ).toBeUndefined();
		expect( state.results?.ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 1 ] );
	} );

	test( "an unfinished game has no results", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );

		expect( ( await run( memory, engine.getState( P1.id ) ) ).results ).toBeUndefined();
	} );
} );

// ===========================================================================
describe( "splendor — undo / redo", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "undo rewinds a pick — tokens go back to the board and the turn resets", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens(
			{ tokens: { diamond: 1, sapphire: 1, emerald: 1 } },
			P1
		) );

		await run( memory, engine.undo( P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.tokens ).toEqual( tokens() );
		expect( state.view.tokens.diamond ).toBe( 5 );
		expect( state.context.turn ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "redo re-applies the undone purchase", async () => {
		const engine = await bootSplendor( memory );
		const target = persisted( memory ).state.cards[ 1 ][ 0 ]!;
		patchPlayer( memory, P1.id, { tokens: tokens( target.cost ) } );
		await run( memory, engine.purchaseCard( { cardId: target.id, payment: target.cost }, P1 ) );

		await run( memory, engine.undo( P1 ) );
		expect( ( await run( memory, engine.getState( P1.id ) ) )
			.view.playerData[ P1.id ]!.cards ).toHaveLength( 0 );

		await run( memory, engine.redo( P1 ) );
		expect( ( await run( memory, engine.getState( P1.id ) ) )
			.view.playerData[ P1.id ]!.cards.map( c => c.id ) ).toEqual( [ target.id ] );
	} );

	test( "redo at the newest commit fails with NothingToRedo", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );

		const error = await runFail( memory, engine.redo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToRedo" );
	} );

	test( "a fresh move after an undo drops the redo tail", async () => {
		const engine = await bootSplendor( memory );
		await run( memory, engine.pickTokens( { tokens: { diamond: 1 } }, P1 ) );
		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.pickTokens( { tokens: { ruby: 2 } }, P1 ) );

		const error = await runFail( memory, engine.redo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToRedo" );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.playerData[ P1.id ]!.tokens ).toEqual( tokens( { ruby: 2 } ) );
	} );
} );

// ===========================================================================
describe( "splendor — bots & scheduling", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "addBots fills the empty seats", async () => {
		const engine = await run( memory, splendor );
		await run( memory, engine.initialize( {
			id: GID, code: CODE, config: { ...CONFIG, playerCount: 3 }, seed: "seed"
		} ) );
		await run( memory, engine.join( P1 ) );
		await run( memory, engine.addBots( P1.id ) );

		const state = await run( memory, engine.getState( P1.id ) );
		const roster = Object.values( state.players );
		expect( roster ).toHaveLength( 3 );
		expect( roster.filter( p => p.isBot ) ).toHaveLength( 2 );
		// Every seat, bot or not, gets its own player slice from `onJoin`.
		expect( Object.keys( state.view.playerData ) ).toHaveLength( 3 );
	} );

	test( "a non-member can neither start the game nor add bots", async () => {
		const engine = await bootSplendor( memory, { start: false } );

		expect( ( await runFail( memory, engine.start( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
		expect( ( await runFail( memory, engine.addBots( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
	} );

	test( "filling an autoStart game arms an auto-start alarm that starts it", async () => {
		const engine = await bootSplendor( memory, {
			start: false,
			config: { autoStart: true }
		} );
		expect( memory.scheduler.scheduled.map( s => s.alarm ) ).toContain( "auto-start" );

		await run( memory, engine.alarm() );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).status ).toBe( "IN_PROGRESS" );
	} );

	test( "a seated bot stalls the game forever — splendor declares no botMove", async () => {
		const engine = await bootSplendor( memory, { players: [ BOT, P1 ] } );

		// The engine arms the alarm for the pending bot...
		expect( memory.scheduler.scheduled.map( s => s.alarm ) ).toContain( "bot" );
		const before = memory.log.commits.length;

		await run( memory, engine.alarm() );

		// ...but `structure.botMove` is undefined, so the alarm returns without
		// moving, and nothing re-arms it. The bot's turn never ends.
		expect( memory.log.commits.length ).toBe( before );
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.currentPlayer ).toBe( BOT.id );
		expect( state.context.turn ).toBe( 0 );
	} );

	test( "cleanup clears the board and cancels every timer", async () => {
		const engine = await bootSplendor( memory, { players: [ BOT, P1 ] } );
		expect( memory.scheduler.scheduled ).not.toHaveLength( 0 );

		await run( memory, engine.cleanup() );
		expect( memory.store.value ).toBeNull();
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );
	} );
} );
