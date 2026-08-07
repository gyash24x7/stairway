import { beforeEach, describe, expect, test } from "bun:test";

import { tictactoe } from "@/games/tictactoe/server/engine.ts";
import { WINNING_LINES } from "@/games/tictactoe/server/utils.ts";
import type { CellValue } from "@/games/tictactoe/shared/schema.ts";
import { GameCode, GameId, type PlayerId, type PlayerInfo } from "@/shared/swish/schema.ts";
import { makeMemory, type Memory, player, run, runFail } from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

/** Joins first, so `onJoin` seats it on X and it opens every game. */
const P1 = player( "p1" );
/** Joins second — O. */
const P2 = player( "p2" );
/** Never joins anything — used to prove `assertMember` gates each command. */
const STRANGER = player( "p9" );
const BOT = player( "bot", true );

const CONFIG = { playerCount: 2, autoStart: false };
const EMPTY_BOARD = Array.from( { length: 9 }, () => null as CellValue );

/** Builds the engine over a fresh in-memory host. */
const makeGame = ( memory: Memory ) => run( memory, tictactoe );

type Engine = Awaited<ReturnType<typeof makeGame>>;

/**
 * The snapshot the fake `GameStore` holds. `getState` is member-only, so the
 * pre-join lifecycle can only be asserted through the store itself.
 */
const persisted = ( memory: Memory ) => memory.store.value as {
	status: string;
	state: { board: ReadonlyArray<CellValue>; symbols: { X: string; O: string } };
	context: { turn: number; players: ReadonlyArray<PlayerId>; currentPlayer: PlayerId };
	players: Record<string, unknown>;
};

/** The table + per-player payload of the most recent broadcast. */
const lastBroadcast = ( memory: Memory ) => memory.broadcasts.at( -1 )! as {
	channel: string;
	snapshot: {
		table: { view: { _tag: string; board: ReadonlyArray<CellValue>; playerId?: string } };
		playerViews: Record<string, { view: { _tag: string; playerId?: string } }>;
	};
};

/** initialize → join every player → (optionally) start a game. */
async function boot(
	memory: Memory,
	opts: {
		config?: Partial<typeof CONFIG>;
		players?: ReadonlyArray<PlayerInfo>;
		start?: boolean;
	} = {}
) {
	const engine = await makeGame( memory );
	const config = { ...CONFIG, ...opts.config };
	const players = opts.players ?? [ P1, P2 ];

	await run( memory, engine.initialize( { id: GID, code: CODE, config, seed: "seed" } ) );
	for ( const p of players ) {
		await run( memory, engine.join( p ) );
	}

	if ( opts.start !== false ) {
		await run( memory, engine.start( players[ 0 ]!.id ) );
	}

	return engine;
}

/** Plays `positions` in order, alternating between the two seats (X first). */
async function play(
	memory: Memory,
	engine: Engine,
	positions: ReadonlyArray<number>,
	players: ReadonlyArray<PlayerInfo> = [ P1, P2 ]
) {
	for ( const [ i, position ] of positions.entries() ) {
		await run( memory, engine.place( { position }, players[ i % players.length ]! ) );
	}
}

/**
 * The move order that hands `line` to X: X takes the line, O fills the two
 * lowest cells outside it (two cells can never make a line of their own).
 */
const winningSequence = ( line: ReadonlyArray<number> ) => {
	const [ o1, o2 ] = Array.from( { length: 9 }, ( _, i ) => i )
		.filter( ( i ) => !line.includes( i ) );

	return [ line[ 0 ]!, o1!, line[ 1 ]!, o2!, line[ 2 ]! ];
};

/** X: 0,1,5,6,7 — O: 2,3,4,8. Fills the board with every line broken. */
const DRAW_SEQUENCE = [ 0, 2, 1, 3, 5, 4, 6, 8, 7 ];

/** Fires alarms until the game reports COMPLETED, guarding against a stall. */
async function drainAlarms( memory: Memory, engine: Engine, actor: PlayerInfo ) {
	for ( let i = 0; i < 20; i++ ) {
		const state = await run( memory, engine.getState( actor.id ) );
		if ( state.status === "COMPLETED" ) {
			return i;
		}

		await run( memory, engine.alarm() );
	}

	throw new Error( "bot self-play did not finish within 20 alarms" );
}

// ===========================================================================
describe( "tictactoe — setup & lifecycle", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "initialize seeds an empty 3x3 board with no symbols assigned", async () => {
		const engine = await makeGame( memory );
		await run( memory, engine.initialize( {
			id: GID, code: CODE, config: CONFIG, seed: "seed"
		} ) );

		const genesis = persisted( memory );
		expect( genesis.status ).toBe( "CREATED" );
		expect( genesis.state.board ).toEqual( EMPTY_BOARD );
		expect( genesis.state.symbols ).toEqual( { X: "", O: "" } );
		expect( Object.keys( genesis.players ) ).toHaveLength( 0 );
		// The genesis snapshot is the log's base, not a commit.
		expect( memory.log.base ).not.toBeNull();
		expect( memory.log.commits ).toHaveLength( 0 );
	} );

	test( "onJoin seats the first player on X and the second on O", async () => {
		const engine = await boot( memory, { start: false } );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.view.symbols ).toEqual( { X: P1.id, O: P2.id } );
		expect( state.context.currentPlayer ).toBe( P1.id );
		expect( state.status ).toBe( "PLAYERS_READY" );
	} );

	test( "a third player cannot take a seat (GameFull)", async () => {
		const engine = await boot( memory, { start: false } );
		const error = await runFail( memory, engine.join( player( "p3" ) ) );
		expect( error._tag ).toBe( "swish/GameFull" );
	} );

	test( "start puts the game IN_PROGRESS with X to move", async () => {
		const engine = await boot( memory );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.turn ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
		expect( state.view.board ).toEqual( EMPTY_BOARD );
	} );

	test( "addBots fills the open seat and the bot is assigned O", async () => {
		const engine = await boot( memory, { players: [ P1 ], start: false } );
		await run( memory, engine.addBots( P1.id ) );

		const state = await run( memory, engine.getState( P1.id ) );
		const roster = Object.values( state.players );
		expect( roster ).toHaveLength( 2 );
		expect( roster.filter( ( p ) => p.isBot ) ).toHaveLength( 1 );
		expect( state.view.symbols.X ).toBe( P1.id );
		expect( state.view.symbols.O ).not.toBe( "" );
	} );

	test( "cleanup clears the snapshot and cancels every timer", async () => {
		const engine = await boot( memory, { players: [ BOT, P1 ] } );
		expect( memory.scheduler.scheduled ).not.toHaveLength( 0 );

		await run( memory, engine.cleanup() );
		expect( memory.store.value ).toBeNull();
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );
	} );

	test( "a non-member can neither read the board nor place (NotAMember)", async () => {
		const engine = await boot( memory );
		expect( ( await runFail( memory, engine.getState( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
		expect( ( await runFail( memory, engine.place( { position: 0 }, STRANGER ) ) )._tag )
			.toBe( "swish/NotAMember" );
	} );
} );

// ===========================================================================
describe( "tictactoe — place: validate & turn flow", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a place writes the actor's symbol and hands the turn over", async () => {
		const engine = await boot( memory );
		await run( memory, engine.place( { position: 4 }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.board[ 4 ] ).toBe( "X" );
		expect( state.context.turn ).toBe( 1 );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );

	test( "resolveNextPlayer alternates the two seats every turn", async () => {
		const engine = await boot( memory );
		await play( memory, engine, [ 0, 3, 1 ] );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.board ).toEqual( [
			"X", "X", null,
			"O", null, null,
			null, null, null
		] );
		expect( state.context.turn ).toBe( 3 );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );

	test( "a place by the wrong player fails with NotYourTurn", async () => {
		const engine = await boot( memory );
		const error = await runFail( memory, engine.place( { position: 0 }, P2 ) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "a place before the game starts fails with GameNotInProgress", async () => {
		const engine = await boot( memory, { start: false } );
		const error = await runFail( memory, engine.place( { position: 0 }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "a negative cell index is rejected (InvalidMove)", async () => {
		const engine = await boot( memory );
		const error = await runFail( memory, engine.place( { position: -1 }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( ( error as { reason: string } ).reason ).toBe( "Invalid position." );
	} );

	test( "a cell index past the last square is rejected (InvalidMove)", async () => {
		const engine = await boot( memory );
		const error = await runFail( memory, engine.place( { position: 9 }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( ( error as { reason: string } ).reason ).toBe( "Invalid position." );
	} );

	test( "an occupied cell is rejected (InvalidMove)", async () => {
		const engine = await boot( memory );
		await run( memory, engine.place( { position: 4 }, P1 ) );

		const error = await runFail( memory, engine.place( { position: 4 }, P2 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( ( error as { reason: string } ).reason ).toBe( "Cell is already occupied." );
	} );

	test( "a rejected place leaves the board and the turn untouched", async () => {
		const engine = await boot( memory );
		const before = memory.log.commits.length;
		await runFail( memory, engine.place( { position: 42 }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.board ).toEqual( EMPTY_BOARD );
		expect( state.context.currentPlayer ).toBe( P1.id );
		expect( memory.log.commits.length ).toBe( before );
	} );

	test( "the game declares no describe, so the action feed stays empty", async () => {
		const engine = await boot( memory );
		await run( memory, engine.place( { position: 0 }, P1 ) );

		expect( await run( memory, engine.getLog( P1.id ) ) ).toEqual( [] );
	} );
} );

// ===========================================================================
describe( "tictactoe — endIf: wins & draws", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	for ( const line of WINNING_LINES ) {
		test( `completing line ${ line.join( "-" ) } ends the game for X`, async () => {
			const engine = await boot( memory );
			await play( memory, engine, winningSequence( line ) );

			const state = await run( memory, engine.getState( P1.id ) );
			expect( state.status ).toBe( "COMPLETED" );
			expect( state.view.winner ).toBe( P1.id );
			expect( line.map( ( i ) => state.view.board[ i ] ) ).toEqual( [ "X", "X", "X" ] );
		} );
	}

	test( "O can win too — the winner is resolved from the symbol map", async () => {
		const engine = await boot( memory );
		// X: 0,1,8 (never a line) — O completes 3-4-5.
		await play( memory, engine, [ 0, 3, 1, 4, 8, 5 ] );

		const state = await run( memory, engine.getState( P2.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( P2.id );
	} );

	test( "a full board with no line is a draw", async () => {
		const engine = await boot( memory );
		await play( memory, engine, DRAW_SEQUENCE );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( "draw" );
		expect( state.view.board.includes( null ) ).toBe( false );
	} );

	test( "a completed game accepts no further places (GameNotInProgress)", async () => {
		const engine = await boot( memory );
		await play( memory, engine, winningSequence( [ 0, 1, 2 ] ) );

		// Cells 5-8 are still empty, so only the status stops the move.
		const error = await runFail( memory, engine.place( { position: 5 }, P2 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "the game does not end while a line is still incomplete", async () => {
		const engine = await boot( memory );
		await play( memory, engine, [ 0, 3, 1 ] );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.view.winner ).toBeUndefined();
	} );
} );

// ===========================================================================
describe( "tictactoe — views & broadcasts", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "each player gets their own tagged view carrying their id", async () => {
		const engine = await boot( memory );
		await run( memory, engine.place( { position: 0 }, P1 ) );

		const forP1 = await run( memory, engine.getState( P1.id ) );
		const forP2 = await run( memory, engine.getState( P2.id ) );

		expect( forP1.view ).toMatchObject( {
			_tag: "tictactoe/PlayerView",
			playerId: P1.id
		} );
		expect( forP2.view ).toMatchObject( {
			_tag: "tictactoe/PlayerView",
			playerId: P2.id
		} );
		// The board is public information — both audiences see the same cells.
		expect( forP1.view.board ).toEqual( forP2.view.board );
	} );

	test( "the table projection carries the board but names no player", async () => {
		const engine = await boot( memory );
		await run( memory, engine.place( { position: 8 }, P1 ) );

		const table = lastBroadcast( memory ).snapshot.table.view;
		expect( table._tag ).toBe( "tictactoe/TableView" );
		expect( table.playerId ).toBeUndefined();
		expect( table.board[ 8 ] ).toBe( "X" );
	} );

	test( "every commit broadcasts table + per-player snapshots on the game channel", async () => {
		const engine = await boot( memory );
		await run( memory, engine.place( { position: 0 }, P1 ) );

		const last = lastBroadcast( memory );
		expect( last.channel ).toBe( "tic-tac-toe:g1" );
		expect( Object.keys( last.snapshot.playerViews ).sort() ).toEqual( [ "p1", "p2" ] );
		expect( last.snapshot.playerViews[ "p2" ]!.view.playerId ).toBe( "p2" );
	} );
} );

// ===========================================================================
describe( "tictactoe — determinism & undo/redo", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "the same move sequence produces the same board in a fresh host", async () => {
		const other = makeMemory();
		const engineA = await boot( memory );
		const engineB = await boot( other );

		await play( memory, engineA, DRAW_SEQUENCE );
		await play( other, engineB, DRAW_SEQUENCE );

		const a = await run( memory, engineA.getState( P1.id ) );
		const b = await run( other, engineB.getState( P1.id ) );
		expect( a.view ).toEqual( b.view );
		expect( a.context ).toEqual( b.context );
	} );

	test( "rewinding every place refolds the log back to the empty board", async () => {
		const engine = await boot( memory );
		const moves = winningSequence( [ 0, 1, 2 ] );
		await play( memory, engine, moves );

		for ( let i = 0; i < moves.length; i++ ) {
			await run( memory, engine.undo( P1 ) );
		}

		const state = await run( memory, engine.getState( P1.id ) );
		// Back to the commit `start` produced: in progress, nothing placed.
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.view.board ).toEqual( EMPTY_BOARD );
		expect( state.view.winner ).toBeUndefined();
		expect( state.context.turn ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "redoing every place refolds the identical finished game", async () => {
		const engine = await boot( memory );
		const moves = winningSequence( [ 0, 4, 8 ] );
		await play( memory, engine, moves );
		const final = await run( memory, engine.getState( P1.id ) );

		for ( let i = 0; i < moves.length; i++ ) {
			await run( memory, engine.undo( P1 ) );
		}

		for ( let i = 0; i < moves.length; i++ ) {
			await run( memory, engine.redo( P1 ) );
		}

		const replayed = await run( memory, engine.getState( P1.id ) );
		expect( replayed.view ).toEqual( final.view );
		expect( replayed.context ).toEqual( final.context );
		expect( replayed.status ).toBe( "COMPLETED" );
	} );

	test( "a single undo takes the last place back and returns the turn", async () => {
		const engine = await boot( memory );
		await play( memory, engine, [ 0, 3, 1 ] );
		await run( memory, engine.undo( P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.board[ 1 ] ).toBeNull();
		expect( state.view.board[ 0 ] ).toBe( "X" );
		expect( state.context.turn ).toBe( 2 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "a fresh place after an undo drops the redo tail (NothingToRedo)", async () => {
		const engine = await boot( memory );
		await play( memory, engine, [ 0, 3 ] );
		await run( memory, engine.undo( P1 ) );
		// History forks from here — the undone O at 3 is unreachable.
		await run( memory, engine.place( { position: 6 }, P2 ) );

		const error = await runFail( memory, engine.redo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToRedo" );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.board[ 3 ] ).toBeNull();
		expect( state.view.board[ 6 ] ).toBe( "O" );
	} );
} );

// ===========================================================================
describe( "tictactoe — the minimax bot", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "handing the turn to a bot schedules a bot alarm", async () => {
		const engine = await boot( memory, { players: [ P1, BOT ] } );
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );

		await run( memory, engine.place( { position: 0 }, P1 ) );
		expect( memory.scheduler.scheduled.map( ( s ) => s.alarm ) ).toContain( "bot" );
	} );

	test( "the alarm plays the bot's move and hands the turn back", async () => {
		const engine = await boot( memory, { players: [ P1, BOT ] } );
		await run( memory, engine.place( { position: 0 }, P1 ) );
		await run( memory, engine.alarm() );

		const state = await run( memory, engine.getState( P1.id ) );
		// The centre is the only reply to a corner opening that does not lose.
		expect( state.view.board[ 4 ] ).toBe( "O" );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "the bot blocks an immediate loss", async () => {
		const engine = await boot( memory, { players: [ P1, BOT ] } );
		await run( memory, engine.place( { position: 0 }, P1 ) );
		await run( memory, engine.alarm() );                       // O takes the centre
		await run( memory, engine.place( { position: 1 }, P1 ) );  // X threatens 0-1-2
		await run( memory, engine.alarm() );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.board[ 2 ] ).toBe( "O" );
		expect( state.status ).toBe( "IN_PROGRESS" );
	} );

	test( "the bot takes an immediate win the moment one appears", async () => {
		const engine = await boot( memory, { players: [ P1, BOT ] } );
		await run( memory, engine.place( { position: 0 }, P1 ) );
		await run( memory, engine.alarm() );                       // O: 4
		await run( memory, engine.place( { position: 1 }, P1 ) );
		await run( memory, engine.alarm() );                       // O: 2 (block) — now threatens 2-4-6
		await run( memory, engine.place( { position: 3 }, P1 ) );  // X ignores the threat
		await run( memory, engine.alarm() );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.board[ 6 ] ).toBe( "O" );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( BOT.id );
	} );

	test( "bot vs bot self-play always ends in a draw", async () => {
		const other = player( "bot2", true );
		const engine = await boot( memory, { players: [ BOT, other ] } );
		// The opening actor is a bot, so `start` arms the first alarm itself.
		expect( memory.scheduler.scheduled.map( ( s ) => s.alarm ) ).toContain( "bot" );

		const alarms = await drainAlarms( memory, engine, BOT );

		const state = await run( memory, engine.getState( BOT.id ) );
		expect( alarms ).toBe( 9 );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.winner ).toBe( "draw" );
		expect( state.view.board.includes( null ) ).toBe( false );
		// A completed game arms nothing further.
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );
	} );

	test( "a bot alarm while the human is to act does nothing", async () => {
		const engine = await boot( memory, { players: [ P1, BOT ] } );
		const before = memory.log.commits.length;

		memory.scheduler.scheduled.push( { key: "bot", alarm: "bot" } );
		await run( memory, engine.alarm() );

		expect( memory.log.commits.length ).toBe( before );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).view.board )
			.toEqual( EMPTY_BOARD );
	} );

	test( "a bot alarm on a completed game does nothing", async () => {
		const engine = await boot( memory, { players: [ P1, BOT ] } );
		await play( memory, engine, [ 0, 3, 1, 4, 2 ], [ P1, BOT ] );
		const before = memory.log.commits.length;

		memory.scheduler.scheduled.push( { key: "bot", alarm: "bot" } );
		await run( memory, engine.alarm() );
		expect( memory.log.commits.length ).toBe( before );
	} );

	test( "undoing back past the start cancels the bot alarm", async () => {
		const engine = await boot( memory, { players: [ BOT, P1 ] } );
		expect( memory.scheduler.scheduled ).not.toHaveLength( 0 );

		// Rewinds to PLAYERS_READY: `reconcile` cancels every timer and arms nothing.
		await run( memory, engine.undo( P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "PLAYERS_READY" );
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );
	} );
} );
