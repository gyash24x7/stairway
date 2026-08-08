import { beforeEach, describe, expect, test } from "bun:test";

import { kingdomino } from "@/games/kingdomino/server/engine.ts";
import type {
	Board,
	KingdominoConfig,
	KingdominoState,
	Placement,
	Region,
	ScoreBreakdown,
	Tile
} from "@/games/kingdomino/shared/schema.ts";
import {
	coordKey,
	DOMINO_DECK,
	getValidPlacements
} from "@/games/kingdomino/shared/utils.ts";
import { GameCode, GameId, type PlayerId, type PlayerInfo } from "@/shared/swish/schema.ts";
import { makeMemory, type Memory, player, run, runFail } from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

const P1 = player( "p1" );
const P2 = player( "p2" );
const P3 = player( "p3" );
const P4 = player( "p4" );

const CONFIG: KingdominoConfig = { playerCount: 2, autoStart: false, boardSize: 5 };

/**
 * The persisted record. `getState` hides the undrawn `deck`, so the only way to
 * assert on the deal — and the only way to stage a kingdom the engine would take
 * a full game to reach — is through the store itself.
 */
const stored = ( memory: Memory ) => memory.store.value as {
	status: string;
	context: { turn: number; phase?: string; currentPlayer: PlayerId };
	state: KingdominoState;
};

/** A broadcast view, widened so the table and player variants read alike. */
type BroadcastView = {
	_tag: string;
	playerId?: PlayerId;
	playerData: KingdominoState["playerData"];
	draft: KingdominoState["draft"];
	selectionOrder: KingdominoState["selectionOrder"];
};

/** The table + per-player payload of the most recent broadcast. */
const lastBroadcast = ( memory: Memory ) => memory.broadcasts.at( -1 )! as {
	channel: string;
	snapshot: {
		table: { view: BroadcastView };
		playerViews: Record<string, { view: BroadcastView }>;
	};
};

/** Overwrite one field of the stored snapshot's context, simulating drift. */
const patchContext = ( memory: Memory, patch: Record<string, unknown> ) => {
	const snap = memory.store.value as { context: Record<string, unknown> };
	memory.store.value = { ...snap, context: { ...snap.context, ...patch } };
};

/** Swap in a hand-built kingdom for one player, leaving the rest of the record alone. */
const patchBoard = ( memory: Memory, playerId: PlayerId, board: Board ) => {
	const snap = memory.store.value as { state: KingdominoState };
	const data = snap.state.playerData[ playerId ]!;
	memory.store.value = {
		...snap,
		state: {
			...snap.state,
			playerData: { ...snap.state.playerData, [ playerId ]: { ...data, board } }
		}
	};
};

/** Swap in a hand-built score for one player, leaving the rest of the record alone. */
const patchScore = ( memory: Memory, playerId: PlayerId, score: ScoreBreakdown ) => {
	const snap = memory.store.value as { state: KingdominoState };
	const data = snap.state.playerData[ playerId ]!;
	memory.store.value = {
		...snap,
		state: {
			...snap.state,
			playerData: { ...snap.state.playerData, [ playerId ]: { ...data, score } }
		}
	};
};

/** Empty the undrawn deck, so the draft on the table is the game's last. */
const emptyDeck = ( memory: Memory ) => {
	const snap = memory.store.value as { state: KingdominoState };
	memory.store.value = { ...snap, state: { ...snap.state, deck: [] } };
};

/** A region worth `tiles * crowns`, which is how `calculateScore` scores one. */
const region = ( terrain: Tile["terrain"], tiles: number, crowns: number ) => ( {
	id: `${ terrain }-0-0`,
	terrain,
	tiles,
	placement: [],
	crowns,
	points: tiles * crowns
} satisfies Region );

/** A score breakdown over the given regions, totalled the way the reducer stores it. */
const score = ( ...regions: Region[] ) => ( {
	regions,
	points: regions.reduce( ( sum, r ) => sum + r.points, 0 )
} satisfies ScoreBreakdown );

/** A 5x5 kingdom with every square taken — nothing can ever be placed on it again. */
const sealedKingdom = () => {
	const tiles: Record<string, Tile> = {};
	for ( let x = 0; x < 5; x++ ) {
		for ( let y = 0; y < 5; y++ ) {
			tiles[ coordKey( { x, y } ) ] = { terrain: "water", crowns: 0 };
		}
	}

	return { size: 5, castle: "red", placements: [], tiles } satisfies Board;
};

/** initialize → join every player → (optionally) start a kingdomino game. */
async function boot(
	memory: Memory,
	opts: {
		config?: Partial<KingdominoConfig>;
		players?: PlayerInfo[];
		start?: boolean;
		seed?: string;
	} = {}
) {
	const engine = await run( memory, kingdomino );
	const roster = opts.players ?? [ P1, P2 ];
	// The roster drives the seat count; the schema pins it to the game's legal
	// set, so narrow the derived length to it.
	const config = {
		...CONFIG,
		playerCount: roster.length as KingdominoConfig[ "playerCount" ],
		...opts.config
	};

	await run( memory, engine.initialize( {
		id: GID, code: CODE, config, seed: opts.seed ?? "seed"
	} ) );
	for ( const p of roster ) {
		await run( memory, engine.join( p ) );
	}

	if ( opts.start !== false ) {
		await run( memory, engine.start( roster[ 0 ]!.id ) );
	}

	return engine;
}

type Engine = Awaited<ReturnType<typeof boot>>;

const seatOf = ( roster: PlayerInfo[], id: PlayerId ) => roster.find( ( p ) => p.id === id )!;

/** Claims the first unclaimed draft entry on behalf of whoever is to pick. */
async function pick( memory: Memory, engine: Engine, roster: PlayerInfo[] ) {
	const { state, context } = stored( memory );
	const entry = state.draft.find( ( e ) => !e.selectedBy )!;
	await run( memory, engine.selectDomino(
		{ dominoId: entry.domino.id },
		seatOf( roster, context.currentPlayer )
	) );

	return entry.domino.id;
}

/** Claims every remaining slot of the current draft, in selection order. */
async function pickAll( memory: Memory, engine: Engine, roster: PlayerInfo[] ) {
	while ( stored( memory ).context.phase === "SELECT" ) {
		await pick( memory, engine, roster );
	}
}

/**
 * Plays one PLACE action for the player to act: the lowest-id domino in their
 * queue goes to the first legal square, or is discarded when the kingdom has no
 * room left for it. Returns `true` if it was a discard.
 */
async function placeOne( memory: Memory, engine: Engine, roster: PlayerInfo[] ) {
	const { state, context } = stored( memory );
	const pid = ( state.playerData[ context.currentPlayer ]?.queue.length ?? 0 ) > 0
		? context.currentPlayer
		: ( Object.keys( state.playerData ) as PlayerId[] )
			.find( ( id ) => state.playerData[ id ]!.queue.length > 0 )!;

	const data = state.playerData[ pid ]!;
	const dominoId = Math.min( ...data.queue );
	const legal = getValidPlacements( data.board, dominoId );
	const seat = seatOf( roster, pid );

	if ( legal.length === 0 ) {
		await run( memory, engine.discardDomino( { dominoId }, seat ) );
		return true;
	}

	await run( memory, engine.placeDomino( { placement: legal[ 0 ]! }, seat ) );
	return false;
}

/** Empties every queue, ending the PLACE phase. */
async function placeAll( memory: Memory, engine: Engine, roster: PlayerInfo[] ) {
	while ( stored( memory ).context.phase === "PLACE" ) {
		await placeOne( memory, engine, roster );
	}
}

/** Plays the whole game out, returning how many dominoes had to be discarded. */
async function playOut( memory: Memory, engine: Engine, roster: PlayerInfo[] ) {
	let discards = 0;
	let moves = 0;

	while ( stored( memory ).status === "IN_PROGRESS" && moves < 500 ) {
		if ( stored( memory ).context.phase === "SELECT" ) {
			await pick( memory, engine, roster );
		} else if ( await placeOne( memory, engine, roster ) ) {
			discards += 1;
		}

		moves += 1;
	}

	return { discards, moves };
}

// ===========================================================================
describe( "kingdomino — setup", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "initialize seeds an empty table: no deck, no draft, no players", async () => {
		// Nobody joins, but the config still declares a legal seat count — the
		// schema pins `playerCount` to 2-4, so a roster-derived 0 is rejected.
		await boot( memory, { start: false, players: [], config: { playerCount: 2 } } );

		const { status, state } = stored( memory );
		expect( status ).toBe( "CREATED" );
		expect( state ).toEqual( { playerData: {}, deck: [], draft: [], selectionOrder: [] } );
		// The shuffle is an event of `start`, not of `setup` — genesis holds no cards.
		expect( memory.log.commits ).toHaveLength( 0 );
	} );

	test( "each joiner is seated with a castle-only kingdom, coloured by seat", async () => {
		await boot( memory, { start: false, players: [ P1, P2, P3 ] } );

		const { state } = stored( memory );
		expect( Object.keys( state.playerData ) ).toEqual( [ "p1", "p2", "p3" ] );
		expect( [ P1, P2, P3 ].map( ( p ) => state.playerData[ p.id ]!.board.castle ) )
			.toEqual( [ "red", "blue", "green" ] );

		for ( const p of [ P1, P2, P3 ] ) {
			const data = state.playerData[ p.id ]!;
			expect( data.board.tiles ).toEqual( { "0,0": { terrain: "castle", crowns: 0 } } );
			expect( data.queue ).toEqual( [] );
			expect( data.score ).toEqual( { regions: [], points: 0 } );
		}
	} );

	test( "the kingdom is sized by config", async () => {
		await boot( memory, { start: false, config: { boardSize: 7 } } );
		expect( stored( memory ).state.playerData[ P1.id ]!.board.size ).toBe( 7 );
	} );

	test( "start deals a four-domino draft off a full 48-card deck", async () => {
		await boot( memory );

		const { state } = stored( memory );
		expect( state.draft ).toHaveLength( 4 );
		expect( state.deck ).toHaveLength( 44 );
		// The draft is always presented in ascending id order.
		const ids = state.draft.map( ( e ) => e.domino.id );
		expect( ids ).toEqual( ids.toSorted( ( a, b ) => a - b ) );
		// Draft + deck is exactly the canonical deck, no duplicates, nothing lost.
		expect( [ ...ids, ...state.deck.map( ( d ) => d.id ) ].toSorted( ( a, b ) => a - b ) )
			.toEqual( DOMINO_DECK.map( ( d ) => d.id ) );
	} );

	test( "each supported player count gets its own draft rhythm", async () => {
		// Two players pick twice a round; three or four pick once — so the selection
		// order is 4, 3 and 4 slots long respectively.
		const cases = [
			{ roster: [ P1, P2 ], slots: 4, each: 2 },
			{ roster: [ P1, P2, P3 ], slots: 3, each: 1 },
			{ roster: [ P1, P2, P3, P4 ], slots: 4, each: 1 }
		];

		for ( const { roster, slots, each } of cases ) {
			const scoped = makeMemory();
			await boot( scoped, { players: roster } );

			const { state } = stored( scoped );
			expect( state.selectionOrder ).toHaveLength( slots );
			for ( const p of roster ) {
				expect( state.selectionOrder.filter( ( id ) => id === p.id ) ).toHaveLength( each );
			}

			// Four dominoes are always dealt, however many of them get claimed.
			expect( state.draft ).toHaveLength( 4 );
		}
	} );
} );

// ===========================================================================
describe( "kingdomino — determinism & replay", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "the shuffled deck is captured in the log, so a replay deals the same cards", async () => {
		await boot( memory );

		const events = ( memory.log.commits.at( -1 ) as { events: Array<{ _tag: string }> } ).events;
		const shuffled = events.find( ( e ) => e._tag === "kingdomino/DeckShuffled" ) as
			unknown as { deck: ReadonlyArray<{ id: number }> };

		// The whole deal lives in one event: replaying the log reproduces it exactly,
		// without re-running the shuffle.
		expect( shuffled.deck ).toHaveLength( 48 );
		expect( shuffled.deck.map( ( d ) => d.id ).toSorted( ( a, b ) => a - b ) )
			.toEqual( DOMINO_DECK.map( ( d ) => d.id ) );

		const { state } = stored( memory );
		expect( [ ...state.draft.map( ( e ) => e.domino.id ), ...state.deck.map( ( d ) => d.id ) ]
			.toSorted( ( a, b ) => a - b ) )
			.toEqual( shuffled.deck.map( ( d ) => d.id ).toSorted( ( a, b ) => a - b ) );
	} );

	test( "refolding the same log rebuilds the identical state", async () => {
		const engine = await boot( memory );
		await pick( memory, engine, [ P1, P2 ] );
		await pick( memory, engine, [ P1, P2 ] );

		const before = await run( memory, engine.getState( P1.id ) );
		// undo + redo is a round trip through `refold`: genesis + every commit,
		// re-applied from scratch. Same log in, same state out.
		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.redo( P1 ) );

		expect( await run( memory, engine.getState( P1.id ) ) ).toEqual( before );
	} );

	test( "a fixed seed fixes the deal", async () => {
		// `hooks.onStart` shuffles the deck and the selection order through the
		// engine's seeded `rng()`, so the same seed deals the same game.
		const a = makeMemory();
		const b = makeMemory();
		await boot( a );
		await boot( b );

		expect( stored( a ).state.deck ).toEqual( stored( b ).state.deck );
		expect( stored( a ).state.selectionOrder ).toEqual( stored( b ).state.selectionOrder );

		// ...and a different seed deals a different game, so the assertions above
		// are about the seed rather than a constant.
		const c = makeMemory();
		await boot( c, { seed: "another-seed" } );
		expect( stored( c ).state.deck ).not.toEqual( stored( a ).state.deck );
	} );
} );

// ===========================================================================
describe( "kingdomino — the phase machine", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "start enters SELECT seated on the first slot of the selection order", async () => {
		const engine = await boot( memory );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.phase ).toBe( "SELECT" );
		expect( state.context.currentPlayer ).toBe( state.view.selectionOrder[ 0 ]! );
	} );

	test( "SELECT walks the selection order slot by slot", async () => {
		const engine = await boot( memory );
		const order = stored( memory ).state.selectionOrder;

		await pick( memory, engine, [ P1, P2 ] );
		expect( stored( memory ).context.currentPlayer ).toBe( order[ 1 ]! );

		await pick( memory, engine, [ P1, P2 ] );
		expect( stored( memory ).context.currentPlayer ).toBe( order[ 2 ]! );
	} );

	test( "claiming the last slot exits SELECT for PLACE", async () => {
		const engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );

		const { context, state } = stored( memory );
		expect( context.phase ).toBe( "PLACE" );
		// Every player now holds the dominoes they claimed.
		expect( state.playerData[ P1.id ]!.queue ).toHaveLength( 2 );
		expect( state.playerData[ P2.id ]!.queue ).toHaveLength( 2 );
	} );

	test( "PLACE opens on whoever claimed the lowest-id domino", async () => {
		const engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );

		const { context, state } = stored( memory );
		const lowest = state.draft.toSorted( ( a, b ) => a.domino.id - b.domino.id )[ 0 ]!;
		expect( context.currentPlayer ).toBe( lowest.selectedBy! );
	} );

	test( "emptying every kingdom's queue returns to SELECT with a fresh draft", async () => {
		const engine = await boot( memory );
		const firstDraft = stored( memory ).state.draft.map( ( e ) => e.domino.id );

		await pickAll( memory, engine, [ P1, P2 ] );
		await placeAll( memory, engine, [ P1, P2 ] );

		const { context, state } = stored( memory );
		expect( context.phase ).toBe( "SELECT" );
		expect( state.draft ).toHaveLength( 4 );
		expect( state.draft.every( ( e ) => !e.selectedBy ) ).toBe( true );
		expect( state.draft.map( ( e ) => e.domino.id ) ).not.toEqual( firstDraft );
		expect( state.deck ).toHaveLength( 40 );
	} );

	test( "next round's order is this round's picks, ranked by domino id", async () => {
		const engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );

		const claimed = stored( memory ).state.draft
			.toSorted( ( a, b ) => a.domino.id - b.domino.id )
			.map( ( e ) => e.selectedBy! );

		await placeAll( memory, engine, [ P1, P2 ] );

		const { context, state } = stored( memory );
		expect( state.selectionOrder ).toEqual( claimed );
		expect( context.currentPlayer ).toBe( claimed[ 0 ]! );
	} );

	test( "a PLACE move made during SELECT is rejected", async () => {
		const engine = await boot( memory );
		const seat = seatOf( [ P1, P2 ], stored( memory ).context.currentPlayer );
		const placement: Placement = { dominoId: 1, coord: { x: 1, y: 0 }, rotation: 0 };

		expect( ( await runFail( memory, engine.placeDomino( { placement }, seat ) ) )._tag )
			.toBe( "swish/MoveNotAllowed" );
		expect( ( await runFail( memory, engine.discardDomino( { dominoId: 1 }, seat ) ) )._tag )
			.toBe( "swish/MoveNotAllowed" );
	} );

	test( "a SELECT move made during PLACE is rejected", async () => {
		const engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );

		const seat = seatOf( [ P1, P2 ], stored( memory ).context.currentPlayer );
		const error = await runFail( memory, engine.selectDomino( { dominoId: 1 }, seat ) );
		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "picking out of turn is rejected", async () => {
		const engine = await boot( memory );
		const { context, state } = stored( memory );
		const other = [ P1, P2 ].find( ( p ) => p.id !== context.currentPlayer )!;

		const error = await runFail( memory, engine.selectDomino(
			{ dominoId: state.draft[ 0 ]!.domino.id },
			other
		) );

		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "in PLACE anyone still holding a domino may act, not just the seated player", async () => {
		const engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );

		// `placeDomino.canMove` replaces the turn gate with "do you hold anything?",
		// so both kingdoms are built in parallel rather than in strict turn order.
		const { context, state } = stored( memory );
		const other = [ P1, P2 ].find( ( p ) => p.id !== context.currentPlayer )!;
		const data = state.playerData[ other.id ]!;
		const dominoId = Math.min( ...data.queue );

		await run( memory, engine.placeDomino(
			{ placement: getValidPlacements( data.board, dominoId )[ 0 ]! },
			other
		) );

		expect( stored( memory ).state.playerData[ other.id ]!.queue ).not.toContain( dominoId );
	} );

	test( "a snapshot pointing at an undeclared phase fails with PhaseNotFound", async () => {
		const engine = await boot( memory );
		patchContext( memory, { phase: "TRADE" } );

		const seat = seatOf( [ P1, P2 ], stored( memory ).context.currentPlayer );
		const error = await runFail( memory, engine.selectDomino( { dominoId: 1 }, seat ) );
		expect( error._tag ).toBe( "swish/PhaseNotFound" );
	} );
} );

// ===========================================================================
describe( "kingdomino — selectDomino rules", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a domino that is not in the draft cannot be claimed", async () => {
		const engine = await boot( memory );
		const seat = seatOf( [ P1, P2 ], stored( memory ).context.currentPlayer );
		const absent = DOMINO_DECK.map( ( d ) => d.id )
			.find( ( id ) => !stored( memory ).state.draft.some( ( e ) => e.domino.id === id ) )!;

		const error = await runFail( memory, engine.selectDomino( { dominoId: absent }, seat ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a domino someone already claimed cannot be claimed again", async () => {
		const engine = await boot( memory );
		const taken = await pick( memory, engine, [ P1, P2 ] );

		const seat = seatOf( [ P1, P2 ], stored( memory ).context.currentPlayer );
		const error = await runFail( memory, engine.selectDomino( { dominoId: taken }, seat ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a player who has used their round's picks cannot take another", async () => {
		const engine = await boot( memory );
		// Three of the four slots spent: one player has now used both their picks.
		await pick( memory, engine, [ P1, P2 ] );
		await pick( memory, engine, [ P1, P2 ] );
		await pick( memory, engine, [ P1, P2 ] );

		const { state } = stored( memory );
		const spent = [ P1, P2 ].find( ( p ) =>
			state.draft.filter( ( e ) => e.selectedBy === p.id ).length === 2 )!;

		// The selection order would never seat them again, so drive it directly.
		patchContext( memory, { currentPlayer: spent.id } );
		const open = state.draft.find( ( e ) => !e.selectedBy )!;

		const error = await runFail( memory, engine.selectDomino(
			{ dominoId: open.domino.id },
			spent
		) );

		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );
} );

// ===========================================================================
describe( "kingdomino — placeDomino rules", () => {
	let memory: Memory;
	let engine: Engine;
	let seat: PlayerInfo;

	beforeEach( async () => {
		memory = makeMemory();
		engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );
		seat = seatOf( [ P1, P2 ], stored( memory ).context.currentPlayer );
	} );

	/** The lowest-id domino in the seated player's queue — the one they must play. */
	const due = () => Math.min( ...stored( memory ).state.playerData[ seat.id ]!.queue );

	test( "a domino the player does not hold cannot be placed", async () => {
		const queue = stored( memory ).state.playerData[ seat.id ]!.queue;
		const notHeld = DOMINO_DECK.map( ( d ) => d.id ).find( ( id ) => !queue.includes( id ) )!;

		const error = await runFail( memory, engine.placeDomino( {
			placement: { dominoId: notHeld, coord: { x: 1, y: 0 }, rotation: 0 }
		}, seat ) );

		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "queued dominoes must be played lowest id first", async () => {
		const queue = stored( memory ).state.playerData[ seat.id ]!.queue;
		const highest = Math.max( ...queue );
		expect( highest ).not.toBe( due() );

		const error = await runFail( memory, engine.placeDomino( {
			placement: { dominoId: highest, coord: { x: 1, y: 0 }, rotation: 0 }
		}, seat ) );

		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a domino cannot be laid over an occupied square", async () => {
		// (0,0) is the castle.
		const error = await runFail( memory, engine.placeDomino( {
			placement: { dominoId: due(), coord: { x: 0, y: 0 }, rotation: 0 }
		}, seat ) );

		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a domino touching no matching terrain cannot be placed", async () => {
		// Two squares clear of the castle: nothing to connect to in an empty kingdom.
		const error = await runFail( memory, engine.placeDomino( {
			placement: { dominoId: due(), coord: { x: 2, y: 2 }, rotation: 0 }
		}, seat ) );

		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a domino cannot be laid outside the kingdom's window", async () => {
		// The castle would have to slide to x = -6 for this to fit.
		const error = await runFail( memory, engine.placeDomino( {
			placement: { dominoId: due(), coord: { x: 9, y: 0 }, rotation: 0 }
		}, seat ) );

		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a legal placement writes both tiles, rescores, and drops the domino", async () => {
		const dominoId = due();
		const domino = DOMINO_DECK[ dominoId - 1 ]!;

		await run( memory, engine.placeDomino( {
			placement: { dominoId, coord: { x: 1, y: 0 }, rotation: 0 }
		}, seat ) );

		const data = stored( memory ).state.playerData[ seat.id ]!;
		expect( data.board.tiles[ "1,0" ] ).toEqual( domino.left );
		expect( data.board.tiles[ "2,0" ] ).toEqual( domino.right );
		expect( data.board.placements ).toHaveLength( 1 );
		expect( data.queue ).not.toContain( dominoId );
		// Two tiles cannot form a scoring territory unless they carry a crown.
		expect( data.score.points ).toBe(
			domino.left.terrain === domino.right.terrain
				? 2 * ( domino.left.crowns + domino.right.crowns )
				: domino.left.crowns + domino.right.crowns
		);
	} );

	test( "a placement that runs off the edge slides the whole kingdom back inside", async () => {
		// A vertical domino down the column left of the castle: legal (it touches the
		// castle) but off-window, so the engine slides everything one square right.
		const dominoId = due();
		const domino = DOMINO_DECK[ dominoId - 1 ]!;
		await run( memory, engine.placeDomino( {
			placement: { dominoId, coord: { x: -1, y: 0 }, rotation: 90 }
		}, seat ) );

		const board = stored( memory ).state.playerData[ seat.id ]!.board;
		expect( board.tiles[ "1,0" ] ).toEqual( { terrain: "castle", crowns: 0 } );
		expect( board.tiles[ "0,0" ] ).toEqual( domino.left );
		expect( board.tiles[ "0,1" ] ).toEqual( domino.right );
		expect( Object.keys( board.tiles ).toSorted() ).toEqual( [ "0,0", "0,1", "1,0" ] );
		// The recorded placement is the shifted one, so a replay lands in the same spot.
		expect( board.placements ).toEqual( [ { dominoId, coord: { x: 0, y: 0 }, rotation: 90 } ] );
	} );
} );

// ===========================================================================
describe( "kingdomino — discardDomino rules", () => {
	let memory: Memory;
	let engine: Engine;
	let seat: PlayerInfo;

	beforeEach( async () => {
		memory = makeMemory();
		engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );
		seat = seatOf( [ P1, P2 ], stored( memory ).context.currentPlayer );
	} );

	const due = () => Math.min( ...stored( memory ).state.playerData[ seat.id ]!.queue );

	test( "a domino the player does not hold cannot be discarded", async () => {
		const queue = stored( memory ).state.playerData[ seat.id ]!.queue;
		const notHeld = DOMINO_DECK.map( ( d ) => d.id ).find( ( id ) => !queue.includes( id ) )!;

		const error = await runFail( memory, engine.discardDomino( { dominoId: notHeld }, seat ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "queued dominoes must be resolved lowest id first", async () => {
		const highest = Math.max( ...stored( memory ).state.playerData[ seat.id ]!.queue );
		const error = await runFail( memory, engine.discardDomino( { dominoId: highest }, seat ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a domino that still fits somewhere cannot be discarded", async () => {
		// A fresh kingdom always has room next to the castle.
		const error = await runFail( memory, engine.discardDomino( { dominoId: due() }, seat ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a domino with nowhere left to go is discarded", async () => {
		patchBoard( memory, seat.id, sealedKingdom() );
		const dominoId = due();

		await run( memory, engine.discardDomino( { dominoId }, seat ) );

		const data = stored( memory ).state.playerData[ seat.id ]!;
		expect( data.queue ).not.toContain( dominoId );
		// A discard never touches the kingdom or the score.
		expect( data.board.placements ).toEqual( [] );
		expect( data.score.points ).toBe( 0 );
	} );
} );

// ===========================================================================
describe( "kingdomino — views & broadcasts", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a player's view names them; the table view does not", async () => {
		const engine = await boot( memory );

		const forP1 = await run( memory, engine.getState( P1.id ) );
		expect( forP1.view._tag ).toBe( "kingdomino/PlayerView" );
		expect( forP1.view._tag === "kingdomino/PlayerView" && forP1.view.playerId ).toBe( P1.id );

		const table = lastBroadcast( memory ).snapshot.table.view;
		expect( table._tag ).toBe( "kingdomino/TableView" );
		expect( table.playerId ).toBeUndefined();
	} );

	test( "the undrawn deck never leaves the server", async () => {
		const engine = await boot( memory );
		// The deck is the one secret in the game: everything else — every kingdom,
		// the draft, the selection order — is public.
		expect( stored( memory ).state.deck ).toHaveLength( 44 );

		const forP1 = await run( memory, engine.getState( P1.id ) );
		expect( forP1.view ).not.toHaveProperty( "deck" );

		const { table, playerViews } = lastBroadcast( memory ).snapshot;
		expect( table.view ).not.toHaveProperty( "deck" );
		for ( const snapshot of Object.values( playerViews ) ) {
			expect( snapshot.view ).not.toHaveProperty( "deck" );
		}
	} );

	test( "both audiences see the same public board", async () => {
		const engine = await boot( memory );
		await pick( memory, engine, [ P1, P2 ] );

		const forP2 = await run( memory, engine.getState( P2.id ) );
		const table = lastBroadcast( memory ).snapshot.table.view;

		expect( table.playerData ).toEqual( forP2.view.playerData );
		expect( table.draft ).toEqual( forP2.view.draft );
		expect( table.selectionOrder ).toEqual( forP2.view.selectionOrder );
	} );

	test( "every commit broadcasts a table view plus one per player", async () => {
		const engine = await boot( memory );
		await pick( memory, engine, [ P1, P2 ] );

		const last = lastBroadcast( memory );
		expect( last.channel ).toBe( "kingdomino:g1" );
		expect( Object.keys( last.snapshot.playerViews ).toSorted() ).toEqual( [ "p1", "p2" ] );
		expect( memory.broadcasts ).toHaveLength( memory.log.commits.length );
	} );

	test( "a non-member cannot read the board", async () => {
		const engine = await boot( memory );
		const error = await runFail( memory, engine.getState( P3.id ) );
		expect( error._tag ).toBe( "swish/NotAMember" );
	} );

	test( "the action feed is empty — kingdomino declares no describe", async () => {
		const engine = await boot( memory );
		await pick( memory, engine, [ P1, P2 ] );
		expect( await run( memory, engine.getLog( P1.id ) ) ).toEqual( [] );
	} );
} );

// ===========================================================================
describe( "kingdomino — completion", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a full game runs the deck dry and completes", async () => {
		const engine = await boot( memory );
		const { moves, discards } = await playOut( memory, engine, [ P1, P2 ] );

		// 48 dominoes: 12 rounds of 4 picks + 4 placements.
		expect( moves ).toBe( 96 );
		// A 5x5 kingdom only holds 12 dominoes, so late ones get thrown away.
		expect( discards ).toBeGreaterThan( 0 );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );

		const { state: raw } = stored( memory );
		expect( raw.deck ).toEqual( [] );
		expect( raw.draft.every( ( e ) => !!e.selectedBy ) ).toBe( true );
		for ( const p of [ P1, P2 ] ) {
			expect( raw.playerData[ p.id ]!.queue ).toEqual( [] );
		}
	}, 30_000 );

	test( "the winner is the player with the most points", async () => {
		const engine = await boot( memory );
		await playOut( memory, engine, [ P1, P2 ] );

		const state = await run( memory, engine.getState( P1.id ) );
		const points = ( id: PlayerId ) => state.view.playerData[ id ]!.score.points;
		const best = [ P1, P2 ].toSorted( ( a, b ) => points( b.id ) - points( a.id ) )[ 0 ]!;

		expect( state.view.winner ).toBe( best.id );
		// Scores are derived, not accumulated: they match a fresh count of the kingdom.
		for ( const p of [ P1, P2 ] ) {
			const data = state.view.playerData[ p.id ]!;
			expect( data.score.points ).toBe(
				data.score.regions.reduce( ( sum, r ) => sum + r.points, 0 )
			);
			expect( data.score.regions.every( ( r ) => r.points === r.tiles * r.crowns ) ).toBe( true );
		}
	}, 30_000 );

	test( "a completed game accepts no further moves", async () => {
		const engine = await boot( memory );
		await playOut( memory, engine, [ P1, P2 ] );

		const error = await runFail( memory, engine.selectDomino( { dominoId: 1 }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	}, 30_000 );

	/**
	 * Stages a finish with hand-built scores: both kingdoms are sealed so every
	 * remaining domino is discarded rather than placed (leaving the staged scores
	 * untouched), and the undrawn deck is emptied so the draft on the table is the
	 * last one. Playing that draft out ends the game on exactly these numbers.
	 */
	const finishWith = async (
		mem: Memory,
		scores: ReadonlyArray<[ PlayerId, ScoreBreakdown ]>
	) => {
		const engine = await boot( mem );
		emptyDeck( mem );
		for ( const [ pid, staged ] of scores ) {
			patchBoard( mem, pid, sealedKingdom() );
			patchScore( mem, pid, staged );
		}

		await playOut( mem, engine, [ P1, P2 ] );
		return run( mem, engine.getState( P1.id ) );
	};

	test( "a tie on points goes to the largest single property", async () => {
		// Both score 10. p2's ten points come off one sprawling lake, p1's off a
		// tighter forest — the rulebook's first tie-break hands it to p2.
		const state = await finishWith( memory, [
			[ P1.id, score( region( "forest", 5, 2 ) ) ],
			[ P2.id, score( region( "water", 10, 1 ) ) ]
		] );

		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( P2.id );
	} );

	test( "a tie on points and property size goes to the most crowns", async () => {
		// Level on points (12) and on largest property (6 tiles), so the second
		// tie-break counts crowns across the whole kingdom: p2 has three to p1's two.
		const state = await finishWith( memory, [
			[ P1.id, score( region( "forest", 6, 2 ) ) ],
			[ P2.id, score( region( "mine", 4, 3 ), region( "water", 6, 0 ) ) ]
		] );

		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( P2.id );
	} );

	test( "a tie on all three resolves to the earlier seat", async () => {
		const state = await finishWith( memory, [
			[ P1.id, score( region( "forest", 6, 2 ) ) ],
			[ P2.id, score( region( "water", 6, 2 ) ) ]
		] );

		expect( state.status ).toBe( "COMPLETED" );
		// The rules call this a shared victory; the engine names one winner, and
		// the sort is stable, so the draw keeps the seating order.
		expect( state.view.winner ).toBe( P1.id );
	} );

	test( "the tie-breaks never override a points lead", async () => {
		// p2 owns both the larger property and more crowns, but is two points down.
		const state = await finishWith( memory, [
			[ P1.id, score( region( "forest", 7, 2 ) ) ],
			[ P2.id, score( region( "water", 12, 1 ) ) ]
		] );

		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( P1.id );
	} );

	test( "resolveResults ranks by points and carries each kingdom's score", async () => {
		const state = await finishWith( memory, [
			[ P1.id, score( region( "forest", 3, 1 ) ) ],
			[ P2.id, score( region( "water", 5, 2 ) ) ]
		] );

		expect( state.results ).toEqual( {
			winner: P2.id,
			ranking: [
				{ playerId: P2.id, rank: 1, score: 10 },
				{ playerId: P1.id, rank: 2, score: 3 }
			]
		} );
	} );

	test( "resolveResults applies the full tie-break chain to the ranking", async () => {
		// Level on points; p2's single sprawling lake takes the first tie-break.
		const state = await finishWith( memory, [
			[ P1.id, score( region( "forest", 5, 2 ) ) ],
			[ P2.id, score( region( "water", 10, 1 ) ) ]
		] );

		expect( state.results?.winner ).toBe( P2.id );
		expect( state.results?.ranking.map( ( r ) => r.playerId ) ).toEqual( [ P2.id, P1.id ] );
		expect( state.results?.ranking.map( ( r ) => r.score ) ).toEqual( [ 10, 10 ] );
	} );

	test( "a tie on all three keys is a shared victory — rank 1 each, no winner", async () => {
		const state = await finishWith( memory, [
			[ P1.id, score( region( "forest", 6, 2 ) ) ],
			[ P2.id, score( region( "water", 6, 2 ) ) ]
		] );

		// `view.winner` names the earlier seat; the standings report the tie honestly.
		expect( state.view.winner ).toBe( P1.id );
		expect( state.results?.winner ).toBeUndefined();
		expect( state.results?.ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 1 ] );
	} );

	test( "an unfinished game has no results", async () => {
		const engine = await boot( memory );

		expect( ( await run( memory, engine.getState( P1.id ) ) ).results ).toBeUndefined();
	} );
} );

// ===========================================================================
describe( "kingdomino — undo / redo", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "undo returns the claimed domino to the draft and re-seats the picker", async () => {
		const engine = await boot( memory );
		const opener = stored( memory ).context.currentPlayer;
		const taken = await pick( memory, engine, [ P1, P2 ] );

		await run( memory, engine.undo( seatOf( [ P1, P2 ], opener ) ) );

		const { context, state } = stored( memory );
		expect( state.draft.find( ( e ) => e.domino.id === taken )!.selectedBy ).toBeUndefined();
		expect( state.playerData[ opener ]!.queue ).toEqual( [] );
		expect( context.currentPlayer ).toBe( opener );
		expect( context.turn ).toBe( 0 );
	} );

	test( "redo re-applies the undone pick", async () => {
		const engine = await boot( memory );
		const opener = stored( memory ).context.currentPlayer;
		const taken = await pick( memory, engine, [ P1, P2 ] );

		const seat = seatOf( [ P1, P2 ], opener );
		await run( memory, engine.undo( seat ) );
		await run( memory, engine.redo( seat ) );

		const { state } = stored( memory );
		expect( state.draft.find( ( e ) => e.domino.id === taken )!.selectedBy ).toBe( opener );
		expect( state.playerData[ opener ]!.queue ).toEqual( [ taken ] );
	} );

	test( "undo unwinds a phase transition back into SELECT", async () => {
		const engine = await boot( memory );
		await pickAll( memory, engine, [ P1, P2 ] );
		expect( stored( memory ).context.phase ).toBe( "PLACE" );

		// The commit that ended SELECT carried the whole transition — exiting the
		// phase, pruning the draft and entering PLACE — so one undo takes it all back.
		await run( memory, engine.undo( P1 ) );

		const { context, state } = stored( memory );
		expect( context.phase ).toBe( "SELECT" );
		expect( state.draft.filter( ( e ) => !e.selectedBy ) ).toHaveLength( 1 );
	} );

	test( "undo before any move leaves the opening draft standing", async () => {
		const engine = await boot( memory );

		// `start` deals the opening draft and is the floor for time travel.
		const error = await runFail( memory, engine.undo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToUndo" );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.view.draft ).not.toEqual( [] );
	} );

	test( "redo at the newest commit fails", async () => {
		const engine = await boot( memory );
		await pick( memory, engine, [ P1, P2 ] );

		const error = await runFail( memory, engine.redo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToRedo" );
	} );
} );

// ===========================================================================
describe( "kingdomino — lifecycle guards", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a move before the game starts is rejected", async () => {
		const engine = await boot( memory, { start: false } );
		const error = await runFail( memory, engine.selectDomino( { dominoId: 1 }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "an under-filled table cannot start", async () => {
		const engine = await boot( memory, { start: false, players: [ P1 ], config: { playerCount: 2 } } );
		const error = await runFail( memory, engine.start( P1.id ) );
		expect( error._tag ).toBe( "swish/CannotStart" );
	} );

	test( "a full table turns anyone else away", async () => {
		const engine = await boot( memory, { start: false } );
		const error = await runFail( memory, engine.join( P3 ) );
		expect( error._tag ).toBe( "swish/GameFull" );
	} );

	test( "cleanup clears the table", async () => {
		const engine = await boot( memory );
		await run( memory, engine.cleanup() );

		expect( memory.store.value ).toBeNull();
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );
	} );

	test( "an alarm is a no-op — kingdomino has no bots", async () => {
		const engine = await boot( memory );
		const before = memory.log.commits.length;

		memory.scheduler.scheduled.push( { key: "bot", alarm: "bot" } );
		await run( memory, engine.alarm() );

		expect( memory.log.commits.length ).toBe( before );
	} );
} );
