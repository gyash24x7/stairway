import { beforeEach, describe, expect, test } from "bun:test";

import { makeEngine } from "@/shared/swish/engine.ts";
import { GameCode, GameId, type PlayerId } from "@/shared/swish/schema.ts";
import type { AlarmKind } from "@/shared/swish/services.ts";
import {
	duelGame,
	hookedGame,
	makeMemory,
	type Memory,
	phasedGame,
	player,
	run,
	runFail,
	runSilent,
	tallyGame
} from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

const P1 = player( "p1" );
const P2 = player( "p2" );
const P3 = player( "p3" );
/** Never joins anything — used to prove `assertMember` gates each command. */
const STRANGER = player( "p9" );

type TallyConfig = {
	playerCount: number;
	autoStart: boolean;
	target: number;
	allowBig: boolean;
	bot: "normal" | "idle" | "broken";
};

const TALLY_CONFIG: TallyConfig = {
	playerCount: 2,
	autoStart: false,
	target: 5,
	allowBig: false,
	bot: "normal"
};

/**
 * The snapshot the fake `GameStore` holds. `getState` is member-only, so the
 * pre-join lifecycle can only be asserted through the store itself.
 */
const persisted = ( memory: Memory ) => memory.store.value as {
	status: string;
	context: { turn: number; players: ReadonlyArray<PlayerId>; currentPlayer: PlayerId };
	players: Record<string, unknown>;
};

/** The table + per-player payload of the most recent broadcast. */
const lastBroadcast = ( memory: Memory ) => memory.broadcasts.at( -1 )! as {
	channel: string;
	snapshot: { table: { view: { me?: number } }; playerViews: Record<string, unknown> };
};

/** initialize → join every player → (optionally) start a tally game. */
async function bootTally(
	memory: Memory,
	opts: {
		config?: Partial<TallyConfig>;
		players?: ReturnType<typeof player>[];
		start?: boolean;
	} = {}
) {
	const engine = await run( memory, makeEngine( tallyGame ) );
	const config = { ...TALLY_CONFIG, ...opts.config };
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

/** initialize → join p1/p2/p3 → start the three-player duel game. */
async function bootDuel( memory: Memory, ghostOnResolve = false ) {
	const engine = await run( memory, makeEngine( duelGame ) );
	await run( memory, engine.initialize( {
		id: GID,
		code: CODE,
		config: { playerCount: 3, autoStart: false, ghostOnResolve },
		seed: "seed"
	} ) );

	for ( const p of [ P1, P2, P3 ] ) {
		await run( memory, engine.join( p ) );
	}

	await run( memory, engine.start( P1.id ) );
	return engine;
}

/** initialize → join p1/p2 → start the two-phase game (enters the `draw` phase). */
async function bootPhased( memory: Memory, players = [ P1, P2 ] ) {
	const engine = await run( memory, makeEngine( phasedGame ) );
	await run( memory, engine.initialize( {
		id: GID, code: CODE, config: { playerCount: 2, autoStart: false }, seed: "seed"
	} ) );

	for ( const p of players ) {
		await run( memory, engine.join( p ) );
	}

	await run( memory, engine.start( players[ 0 ]!.id ) );
	return engine;
}

/** initialize → join p1/p2 → start the hook-tracing game. */
async function bootHooked( memory: Memory, badPhase = false ) {
	const engine = await run( memory, makeEngine( hookedGame ) );
	await run( memory, engine.initialize( {
		id: GID, code: CODE, config: { playerCount: 2, autoStart: false, badPhase }, seed: "seed"
	} ) );

	for ( const p of [ P1, P2 ] ) {
		await run( memory, engine.join( p ) );
	}

	await run( memory, engine.start( P1.id ) );
	return engine;
}

/**
 * Arms a timer directly, bypassing the engine. The engine only ever schedules
 * `auto-start`/`bot`, so this is the only way to drive the other `alarm`
 * branches (and to fire one against state the engine would not have armed).
 */
const arm = ( memory: Memory, alarm: AlarmKind ) => {
	memory.scheduler.scheduled.push( { key: alarm, alarm } );
};

/** Overwrite one field of the stored snapshot's context, simulating drift/corruption. */
const patchStoredContext = ( memory: Memory, patch: Record<string, unknown> ) => {
	const snap = memory.store.value as { context: Record<string, unknown> };
	memory.store.value = { ...snap, context: { ...snap.context, ...patch } };
};

// ===========================================================================
describe( "engine — lifecycle (flat game)", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "initialize seeds a genesis snapshot without emitting a commit", async () => {
		const engine = await run( memory, makeEngine( tallyGame ) );
		await run( memory, engine.initialize( {
			id: GID, code: CODE, config: TALLY_CONFIG, seed: "seed"
		} ) );

		expect( memory.store.value ).not.toBeNull();
		expect( memory.log.base ).not.toBeNull();
		expect( memory.log.commits ).toHaveLength( 0 );
		expect( memory.log.cursor ).toBe( -1 );

		const genesis = persisted( memory );
		expect( genesis.status ).toBe( "CREATED" );
		expect( genesis.context.turn ).toBe( 0 );
		expect( Object.keys( genesis.players ) ).toHaveLength( 0 );
	} );

	test( "the first player to join becomes the current player", async () => {
		const engine = await bootTally( memory, { start: false } );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( Object.keys( state.players ) ).toEqual( [ "p1", "p2" ] );
		expect( state.context.currentPlayer ).toBe( P1.id );
		// join emits a commit + broadcast per player.
		expect( memory.log.commits ).toHaveLength( 2 );
		expect( memory.broadcasts ).toHaveLength( 2 );
	} );

	test( "re-joining an existing seat is a no-op (no new commit)", async () => {
		const engine = await bootTally( memory, { start: false } );
		const before = memory.log.commits.length;
		await run( memory, engine.join( P1 ) );
		expect( memory.log.commits.length ).toBe( before );
	} );

	test( "joining a full game fails with GameFull", async () => {
		const engine = await bootTally( memory, { start: false } );
		const error = await runFail( memory, engine.join( P3 ) );
		expect( error._tag ).toBe( "swish/GameFull" );
	} );

	test( "filling a non-autoStart game flips status to PLAYERS_READY", async () => {
		const engine = await bootTally( memory, { start: false } );
		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "PLAYERS_READY" );
	} );

	test( "start rejects an under-filled game with CannotStart", async () => {
		const engine = await bootTally( memory, { start: false, players: [ P1 ] } );
		const error = await runFail( memory, engine.start( P1.id ) );
		expect( error._tag ).toBe( "swish/CannotStart" );
	} );

	test( "start puts the game IN_PROGRESS", async () => {
		const engine = await bootTally( memory );
		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
	} );

	test( "cleanup clears the snapshot and cancels every timer", async () => {
		const engine = await bootTally( memory, { players: [ player( "bot", true ), P1 ] } );
		expect( memory.scheduler.scheduled ).not.toHaveLength( 0 );

		await run( memory, engine.cleanup() );
		expect( memory.store.value ).toBeNull();
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );
	} );
} );

// ===========================================================================
describe( "engine — membership", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a non-member cannot read the private view (NotAMember)", async () => {
		const engine = await bootTally( memory );
		const error = await runFail( memory, engine.getState( STRANGER.id ) );
		expect( error._tag ).toBe( "swish/NotAMember" );
	} );

	test( "a non-member cannot submit a move (NotAMember)", async () => {
		const engine = await bootTally( memory );
		const error = await runFail( memory, engine.add( { amount: 1 }, STRANGER ) );
		expect( error._tag ).toBe( "swish/NotAMember" );
	} );

	test( "a non-member cannot start or add bots (NotAMember)", async () => {
		const engine = await bootTally( memory, { start: false } );
		expect( ( await runFail( memory, engine.start( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
		expect( ( await runFail( memory, engine.addBots( STRANGER.id ) ) )._tag )
			.toBe( "swish/NotAMember" );
	} );

	test( "a non-member cannot read the action feed (NotAMember)", async () => {
		const engine = await bootTally( memory );
		const error = await runFail( memory, engine.getLog( STRANGER.id ) );
		expect( error._tag ).toBe( "swish/NotAMember" );
	} );
} );

// ===========================================================================
describe( "engine — moves & turn flow", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a move applies its event and advances the turn to the next player", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.scores ).toEqual( { [ P1.id ]: 3 } );
		expect( state.context.turn ).toBe( 1 );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );

	test( "a move by the wrong player fails with NotYourTurn", async () => {
		const engine = await bootTally( memory );
		const error = await runFail( memory, engine.add( { amount: 1 }, P2 ) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "a move before the game starts fails with GameNotInProgress", async () => {
		const engine = await bootTally( memory, { start: false } );
		const error = await runFail( memory, engine.add( { amount: 1 }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "validate can reject a move with InvalidMove", async () => {
		const engine = await bootTally( memory );
		const error = await runFail( memory, engine.add( { amount: 0 }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "a move disabled by enabledWhen fails with MoveNotAllowed", async () => {
		const engine = await bootTally( memory, { config: { allowBig: false } } );
		const error = await runFail( memory, engine.big( { amount: 1 }, P1 ) );
		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "an enabledWhen-gated move runs when the config allows it", async () => {
		const engine = await bootTally( memory, { config: { allowBig: true } } );
		await run( memory, engine.big( { amount: 1 }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.scores ).toEqual( { [ P1.id ]: 10 } );
	} );

	test( "a move with endsTurn:false keeps the current player and turn", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.combo( { amount: 2 }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.scores ).toEqual( { [ P1.id ]: 2 } );
		expect( state.context.turn ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );
} );

// ===========================================================================
describe( "engine — completion & projections", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "reaching the target completes the game", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		await run( memory, engine.add( { amount: 5 }, P2 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.scores ).toEqual( { [ P1.id ]: 3, [ P2.id ]: 5 } );
	} );

	test( "a completed game accepts no further moves (GameNotInProgress)", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		await run( memory, engine.add( { amount: 5 }, P2 ) );

		const error = await runFail( memory, engine.add( { amount: 1 }, P1 ) );
		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "getState redacts the private slice per audience", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );

		// The audience is derived from the caller, so a player only ever sees
		// their own slice; the table projection is what `Sync` broadcasts.
		const forP1 = await run( memory, engine.getState( P1.id ) );
		const forP2 = await run( memory, engine.getState( P2.id ) );
		expect( forP1.view.me ).toBe( 3 );
		expect( forP2.view.me ).toBe( 0 );
		expect( lastBroadcast( memory ).snapshot.table.view.me ).toBeUndefined();
	} );

	test( "getLog derives an action feed from committed events", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );

		const log = await run( memory, engine.getLog( P1.id ) );
		expect( log ).toHaveLength( 1 );
		expect( log[ 0 ]!.text ).toBe( "P1 +3" );
		expect( log[ 0 ]!.kind ).toBe( "tally/Scored" );
	} );

	test( "every commit broadcasts table + per-player snapshots on the game channel", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 1 }, P1 ) );

		const last = lastBroadcast( memory );
		expect( last.channel ).toBe( "tally:g1" );
		expect( last.snapshot.table ).toBeDefined();
		expect( Object.keys( last.snapshot.playerViews ).sort() ).toEqual( [ "p1", "p2" ] );
	} );
} );

// ===========================================================================
describe( "engine — resolveResults", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	/** Plays tally to its target, so `endIf` holds and the game completes. */
	const finish = async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		await run( memory, engine.add( { amount: 5 }, P2 ) );
		return engine;
	};

	test( "an unfinished game carries no results", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.results ).toBeUndefined();
	} );

	test( "completion folds the game's standings into the snapshot", async () => {
		const engine = await finish();

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.results ).toEqual( {
			winner: P2.id,
			ranking: [
				{ playerId: P2.id, rank: 1, score: 5 },
				{ playerId: P1.id, rank: 2, score: 3 }
			]
		} );
	} );

	test( "every audience sees the same results — placement is public", async () => {
		const engine = await finish();

		const forP1 = await run( memory, engine.getState( P1.id ) );
		const forP2 = await run( memory, engine.getState( P2.id ) );
		expect( forP1.results ).toEqual( forP2.results );

		const broadcast = memory.broadcasts.at( -1 )! as {
			snapshot: { table: { results?: unknown } };
		};
		expect( broadcast.snapshot.table.results ).toEqual( forP1.results! );
	} );

	test( "undoing past the finish drops the results again", async () => {
		const engine = await finish();
		const undone = await run( memory, engine.undo( P1 ) );

		expect( undone.status ).toBe( "IN_PROGRESS" );
		expect( undone.results ).toBeUndefined();

		// …and redoing back onto the finish recomputes them from the refolded state.
		const redone = await run( memory, engine.redo( P1 ) );
		expect( redone.status ).toBe( "COMPLETED" );
		expect( redone.results?.winner ).toBe( P2.id );
	} );

	test( "a game that declares no resolveResults completes without results", async () => {
		const engine = await bootPhased( memory );
		await run( memory, engine.drawCard( {}, P1 ) );
		await run( memory, engine.playCard( {}, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.results ).toBeUndefined();
	} );
} );

// ===========================================================================
describe( "engine — archive", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	const KEY = "tally:g1";

	/** Plays tally to its target, so `endIf` holds and the game completes. */
	const finish = async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		await run( memory, engine.add( { amount: 5 }, P2 ) );
		return engine;
	};

	type Archived = {
		id: string;
		code: string;
		status: string;
		table: { scores: Record<string, number>; me?: number };
		playerViews: Record<string, { scores: Record<string, number>; me?: number }>;
		results?: { winner?: string };
	};

	const archived = () => memory.archive.get( KEY ) as Archived;

	test( "an unfinished game is not archived", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );

		expect( memory.archive.has( KEY ) ).toBe( false );
	} );

	test( "completing a game archives it under gameName:gameId", async () => {
		await finish();

		expect( [ ...memory.archive.keys() ] ).toEqual( [ KEY ] );
		expect( archived().id ).toBe( GID );
		expect( archived().code ).toBe( CODE );
		expect( archived().status ).toBe( "COMPLETED" );
	} );

	test( "the archive carries the table view, every player view, and the results", async () => {
		await finish();

		const record = archived();
		expect( record.table ).toEqual( { scores: { p1: 3, p2: 5 } } );
		expect( Object.keys( record.playerViews ).sort() ).toEqual( [ "p1", "p2" ] );
		// Each player's slice is their own — the archive keeps the private views apart.
		expect( record.playerViews[ P1.id ]?.me ).toBe( 3 );
		expect( record.playerViews[ P2.id ]?.me ).toBe( 5 );
		expect( record.results?.winner ).toBe( P2.id );
	} );

	test( "the archive survives JSON — it is what KV round-trips", async () => {
		await finish();

		expect( JSON.parse( JSON.stringify( archived() ) ) ).toEqual( archived() );
	} );

	test( "undoing past the finish drops the archive, redoing restores it", async () => {
		const engine = await finish();

		await run( memory, engine.undo( P1 ) );
		expect( memory.archive.has( KEY ) ).toBe( false );

		await run( memory, engine.redo( P1 ) );
		expect( archived().results?.winner ).toBe( P2.id );
	} );

	test( "a game that declares no resolveResults archives without results", async () => {
		const engine = await bootPhased( memory );
		await run( memory, engine.drawCard( {}, P1 ) );
		await run( memory, engine.playCard( {}, P1 ) );

		const record = memory.archive.get( "phased:g1" ) as Archived;
		expect( record.status ).toBe( "COMPLETED" );
		expect( record.results ).toBeUndefined();
	} );
} );

// ===========================================================================
describe( "engine — undo / redo (event sourcing)", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "undo rewinds the cursor and refolds the prior state", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		await run( memory, engine.undo( P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.scores ).toEqual( {} );
		expect( state.context.turn ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "redo re-applies the undone commit", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.redo( P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.scores ).toEqual( { [ P1.id ]: 3 } );
	} );

	test( "redo at the newest commit fails with NothingToRedo", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );

		const error = await runFail( memory, engine.redo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToRedo" );
	} );

	test( "a new move after an undo drops the redo tail (NothingToRedo)", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		await run( memory, engine.undo( P1 ) );
		// A fresh command forks history — the redo branch is gone.
		await run( memory, engine.add( { amount: 1 }, P1 ) );

		const error = await runFail( memory, engine.redo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToRedo" );
	} );
} );

// ===========================================================================
describe( "engine — bots & scheduling", () => {
	let memory: Memory;
	const BOT = player( "bot", true );
	beforeEach( () => { memory = makeMemory(); } );

	test( "starting with a bot to act schedules a bot alarm", async () => {
		await bootTally( memory, { players: [ BOT, P1 ] } );
		expect( memory.scheduler.scheduled.map( ( s ) => s.alarm ) ).toContain( "bot" );
	} );

	test( "the alarm plays the pending bot's move", async () => {
		const engine = await bootTally( memory, { players: [ BOT, P1 ] } );
		await run( memory, engine.alarm() );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.scores ).toEqual( { [ BOT.id ]: 1 } );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "filling an autoStart game schedules an auto-start alarm the alarm fires", async () => {
		const engine = await bootTally( memory, { start: false, config: { autoStart: true } } );
		expect( memory.scheduler.scheduled.map( ( s ) => s.alarm ) ).toContain( "auto-start" );

		await run( memory, engine.alarm() );
		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
	} );

	test( "addBots fills the remaining seats with bots", async () => {
		const engine = await run( memory, makeEngine( tallyGame ) );
		await run( memory, engine.initialize( {
			id: GID, code: CODE, config: { ...TALLY_CONFIG, playerCount: 3 }, seed: "seed"
		} ) );
		await run( memory, engine.join( P1 ) );
		await run( memory, engine.addBots( P1.id ) );

		const state = await run( memory, engine.getState( P1.id ) );
		const roster = Object.values( state.players );
		expect( roster ).toHaveLength( 3 );
		expect( roster.filter( ( p ) => p.isBot ) ).toHaveLength( 2 );
	} );
} );

// ===========================================================================
describe( "engine — interaction windows", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a move that opens a window suspends turn advancement", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.attack( {}, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.context.interactions ).toHaveLength( 1 );
		expect( state.context.interactions![ 0 ]!.kind ).toBe( "defense" );
		expect( state.context.interactions![ 0 ]!.responders.slice().sort() )
			.toEqual( [ P2.id, P3.id ] );
		// Turn does not advance while the window is open.
		expect( state.context.turn ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "a non-responder cannot answer the window (NotYourTurn)", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.attack( {}, P1 ) );

		const error = await runFail( memory, engine.defend( { block: true }, P1 ) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "a non-response move is rejected while a window is open (MoveNotAllowed)", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.attack( {}, P1 ) );

		const error = await runFail( memory, engine.attack( {}, P2 ) );
		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "a partially-answered simultaneous window is redacted for other audiences", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.attack( {}, P1 ) );
		await run( memory, engine.defend( { block: false }, P2 ) );

		const forP2 = await run( memory, engine.getState( P2.id ) );
		const forP3 = await run( memory, engine.getState( P3.id ) );
		// The responder sees their own answer...
		expect( forP2.context.interactions![ 0 ]!.responses[ P2.id ] ).toEqual( { block: false } );
		// ...everyone else sees only a "responded" marker, not the choice.
		expect( forP3.context.interactions![ 0 ]!.responses[ P2.id ] ).toBe( true );
	} );

	test( "completing the window resolves it: damage lands, turn resumes", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.attack( {}, P1 ) );
		await run( memory, engine.defend( { block: false }, P2 ) );
		await run( memory, engine.defend( { block: true }, P3 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		// p2 did not block → took damage; p3 blocked → unscathed (no hp entry).
		expect( state.view.hp[ P2.id ] ).toBe( 7 );
		expect( state.view.hp[ P3.id ] ).toBeUndefined();
		// Window drained → normal flow resumed from the initiator.
		expect( state.context.interactions ?? [] ).toHaveLength( 0 );
		expect( state.context.turn ).toBe( 1 );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );
} );

// ===========================================================================
describe( "engine — phases", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "start enters the initial phase and sets the starting player", async () => {
		const engine = await bootPhased( memory );
		const state = await run( memory, engine.getState( P1.id ) );

		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.phase ).toBe( "draw" );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "a move belonging to another phase is rejected (MoveNotAllowed)", async () => {
		const engine = await bootPhased( memory );
		const error = await runFail( memory, engine.playCard( {}, P1 ) );
		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "completing a phase transitions to the next one", async () => {
		const engine = await bootPhased( memory );
		await run( memory, engine.drawCard( {}, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.context.phase ).toBe( "play" );
		expect( state.view.drawn ).toBe( true );
	} );

	test( "a move that ends the game out of a phase completes it", async () => {
		const engine = await bootPhased( memory );
		await run( memory, engine.drawCard( {}, P1 ) );
		await run( memory, engine.playCard( {}, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "COMPLETED" );
		expect( state.view.played ).toBe( true );
	} );
} );

// ===========================================================================
describe( "engine — hooks & phase callbacks", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "every hook and phase callback fires, in engine order", async () => {
		const engine = await bootHooked( memory );
		await run( memory, engine.step( {}, P1 ) );
		await run( memory, engine.step( {}, P2 ) );
		await run( memory, engine.finish( {}, P2 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.trace ).toEqual( [
			// join: `onJoin` runs before the seat is taken, once per player.
			"onJoin:p1",
			"onJoin:p2",
			// start: `onStart`, then the initial phase is entered.
			"onStart",
			"enter:warmup",
			// each move: beforeMove → execute → afterMove.
			"before:step",
			"step",
			"after:step",
			"before:step",
			"step",
			"after:step",
			// the second step ends the phase: onExit fires before the next entry.
			"exit:warmup",
			"enter:main",
			"before:finish",
			"finish",
			"after:finish",
			// completion: `onEnd` runs before `GameCompleted`.
			"onEnd"
		] );
		expect( state.status ).toBe( "COMPLETED" );
	} );

	test( "a phase's resolveNextPlayer rotates the actor while the phase runs", async () => {
		const engine = await bootHooked( memory );
		// resolveStartingPlayer seated p1; one step is not enough to end `warmup`.
		await run( memory, engine.step( {}, P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.context.phase ).toBe( "warmup" );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );

	test( "transitioning to an undeclared phase fails with PhaseNotFound", async () => {
		const engine = await bootHooked( memory, true );
		await run( memory, engine.step( {}, P1 ) );
		// The second step ends `warmup`, whose resolveNextPhase names a phase
		// the structure never declared.
		const error = await runFail( memory, engine.step( {}, P2 ) );
		expect( error._tag ).toBe( "swish/PhaseNotFound" );
	} );
} );

// ===========================================================================
describe( "engine — missing & corrupt state", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a command against a game that was never initialized fails with GameNotFound", async () => {
		const engine = await run( memory, makeEngine( tallyGame ) );
		const error = await runFail( memory, engine.getState( P1.id ) );
		expect( error._tag ).toBe( "swish/GameNotFound" );
	} );

	test( "a snapshot that no longer decodes fails with CorruptState", async () => {
		const engine = await bootTally( memory );
		memory.store.value = { _tag: "swish/PersistedGameData", nonsense: true };

		const error = await runFail( memory, engine.getState( P1.id ) );
		expect( error._tag ).toBe( "swish/CorruptState" );
	} );

	test( "a corrupt log base fails the undo refold with CorruptState", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		// The snapshot still decodes (so `assertMember` passes) but the genesis the
		// refold replays from does not.
		memory.log.base = { nonsense: true };

		const error = await runFail( memory, engine.undo( P1 ) );
		expect( error._tag ).toBe( "swish/CorruptState" );
	} );

	test( "a corrupt commit fails getLog with CorruptState", async () => {
		const engine = await bootTally( memory );
		await run( memory, engine.add( { amount: 3 }, P1 ) );
		memory.log.commits[ 0 ] = { nonsense: true };

		const error = await runFail( memory, engine.getLog( P1.id ) );
		expect( error._tag ).toBe( "swish/CorruptState" );
	} );

	test( "getLog is empty for a game that declares no describe", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.attack( {}, P1 ) );

		expect( await run( memory, engine.getLog( P1.id ) ) ).toEqual( [] );
	} );

	test( "a snapshot pointing at an undeclared phase fails with PhaseNotFound", async () => {
		const engine = await bootPhased( memory );
		patchStoredContext( memory, { phase: "ghost" } );

		const error = await runFail( memory, engine.drawCard( {}, P1 ) );
		expect( error._tag ).toBe( "swish/PhaseNotFound" );
	} );
} );

// ===========================================================================
describe( "engine — sequential & nested interactions", () => {
	let memory: Memory;
	beforeEach( () => { memory = makeMemory(); } );

	test( "a sequential window is public — redaction leaves it untouched", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.challenge( {}, P1 ) );

		const state = await run( memory, engine.getState( P3.id ) );
		const frame = state.context.interactions![ 0 ]!;
		expect( frame.kind ).toBe( "duelist" );
		expect( frame.mode ).toBe( "sequential" );
		expect( frame.responders.slice().sort() ).toEqual( [ P2.id, P3.id ] );
	} );

	test( "a sequential window routes to responders in order (NotYourTurn)", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.challenge( {}, P1 ) );

		// p2 is first in `responders`; p3 may not jump the queue.
		const error = await runFail( memory, engine.answer( { value: 1 }, P3 ) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "a response rejected by validate leaves the window open", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.challenge( {}, P1 ) );

		const error = await runFail( memory, engine.answer( { value: -1 }, P2 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.context.interactions ).toHaveLength( 1 );
	} );

	test( "a custom isComplete resolves the window before every responder answers", async () => {
		const engine = await bootDuel( memory );
		await run( memory, engine.challenge( {}, P1 ) );
		// `duelist.isComplete` is satisfied by a single response, so p3 never acts.
		await run( memory, engine.answer( { value: 1 }, P2 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.hp[ P2.id ] ).toBe( 9 );
		expect( state.context.interactions ?? [] ).toHaveLength( 0 );
		// Drained → normal flow resumes from the initiator.
		expect( state.context.turn ).toBe( 1 );
		expect( state.context.currentPlayer ).toBe( P2.id );
	} );

	test( "a nested window of an unknown kind halts the resolve loop", async () => {
		const engine = await bootDuel( memory, true );
		await run( memory, engine.attack( {}, P1 ) );
		await run( memory, engine.defend( { block: false }, P2 ) );
		await run( memory, engine.defend( { block: true }, P3 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		// The defense resolved (damage landed) but its nested `ghost` frame has no
		// definition, so the stack stops draining instead of spinning on it.
		expect( state.view.hp[ P2.id ] ).toBe( 7 );
		expect( state.context.interactions ).toHaveLength( 1 );
		expect( state.context.interactions![ 0 ]!.kind ).toBe( "ghost" );
		// A window is still open, so the turn never advanced.
		expect( state.context.turn ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );
} );

// ===========================================================================
describe( "engine — alarm edge cases", () => {
	let memory: Memory;
	const BOT = player( "bot", true );
	beforeEach( () => { memory = makeMemory(); } );

	test( "an alarm with nothing due is a no-op", async () => {
		const engine = await bootTally( memory );
		const before = memory.log.commits.length;

		await run( memory, engine.alarm() );
		expect( memory.log.commits.length ).toBe( before );
	} );

	test( "an auto-start that cannot run is swallowed, not thrown", async () => {
		const engine = await bootTally( memory );
		// The game is already IN_PROGRESS, so `startInternal` fails CannotStart.
		arm( memory, "auto-start" );
		await runSilent( memory, engine.alarm() );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "IN_PROGRESS" );
	} );

	test( "a move-timeout alarm is ignored — no turn clock is wired up", async () => {
		const engine = await bootTally( memory );
		const before = memory.log.commits.length;

		arm( memory, "move-timeout" );
		await run( memory, engine.alarm() );

		// Documents the gap: an unresponsive human stalls the game forever.
		expect( memory.log.commits.length ).toBe( before );
		expect( ( await run( memory, engine.getState( P1.id ) ) ).context.currentPlayer )
			.toBe( P1.id );
	} );

	test( "a bot alarm on a completed game does nothing", async () => {
		const engine = await bootTally( memory, { players: [ BOT, P1 ] } );
		await run( memory, engine.alarm() );                    // bot scores 1
		await run( memory, engine.add( { amount: 5 }, P1 ) );   // p1 ends it
		const before = memory.log.commits.length;

		arm( memory, "bot" );
		await run( memory, engine.alarm() );
		expect( memory.log.commits.length ).toBe( before );
	} );

	test( "a bot alarm while a human is to act does nothing", async () => {
		const engine = await bootTally( memory, { players: [ P1, BOT ] } );
		const before = memory.log.commits.length;

		arm( memory, "bot" );
		await run( memory, engine.alarm() );
		expect( memory.log.commits.length ).toBe( before );
	} );

	test( "a bot alarm for a game with no bot policy does nothing", async () => {
		// `phasedGame` declares no `botMove`, yet a seated bot still gets an alarm.
		const engine = await bootPhased( memory, [ BOT, P2 ] );
		expect( memory.scheduler.scheduled.map( ( s ) => s.alarm ) ).toContain( "bot" );

		const before = memory.log.commits.length;
		await run( memory, engine.alarm() );
		expect( memory.log.commits.length ).toBe( before );
	} );

	test( "a bot that passes leaves the game untouched", async () => {
		const engine = await bootTally( memory, {
			players: [ BOT, P1 ],
			config: { bot: "idle" }
		} );

		await run( memory, engine.alarm() );
		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.view.scores ).toEqual( {} );
		expect( state.context.currentPlayer ).toBe( BOT.id );
	} );

	test( "a bot move the engine rejects is swallowed, not thrown", async () => {
		const engine = await bootTally( memory, {
			players: [ BOT, P1 ],
			config: { bot: "broken" }
		} );

		await runSilent( memory, engine.alarm() );
		const state = await run( memory, engine.getState( P1.id ) );
		// The bot submitted an invalid amount; the alarm logged it and moved on.
		expect( state.view.scores ).toEqual( {} );
		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.currentPlayer ).toBe( BOT.id );
	} );

	test( "undoing past the start cancels the bot alarm without rescheduling", async () => {
		const engine = await bootTally( memory, { players: [ BOT, P1 ] } );
		expect( memory.scheduler.scheduled ).not.toHaveLength( 0 );

		// Rewinds to PLAYERS_READY: `reconcile` cancels every timer and, because the
		// game is no longer IN_PROGRESS, arms nothing in its place.
		await run( memory, engine.undo( P1 ) );

		const state = await run( memory, engine.getState( P1.id ) );
		expect( state.status ).toBe( "PLAYERS_READY" );
		expect( memory.scheduler.scheduled ).toHaveLength( 0 );
	} );
} );
