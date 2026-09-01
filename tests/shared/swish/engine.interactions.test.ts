import { ParleyConfig, parleyEngine } from "@tests/helpers/games/parley.ts";
import { commitsIn, createInput, runGame, topFrame } from "@tests/helpers/runner.ts";
import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ "a", "b", "c", "d" ].map( player );
const seats = [ a, b, c, d ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const config = ( over: Partial<ParleyConfig> = {} ) =>
	ParleyConfig.make( { playerCount: 4, autoStart: false, target: 99, ...over } );

/** Seats four players at a parley table and starts it, then runs the body. */
const parley = <A, E>(
	body: ( engine: Effect.Success<typeof parleyEngine> ) => Effect.Effect<A, E>,
	over: Partial<ParleyConfig> = {}
) => runGame( parleyEngine, engine => Effect.gen( function* () {
	yield* engine.initialize( createInput( config( over ) ) );
	yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
	yield* engine.start( a );
	return yield* body( engine );
} ) );


describe( "opening a frame", () => {
	test( "a move's execute pushes it onto the stack", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			return yield* engine.getView();
		} ) );

		const frame = topFrame( result.context.interactions )!;

		expect( result.context.interactions ).toHaveLength( 1 );
		expect( frame.kind ).toBe( "duel" );
		expect( frame.initiator ).toBe( a );
		expect( frame.responders ).toEqual( [ b, c, d ] );
		expect( frame.responses ).toEqual( {} );
	} );

	test( "the turn does not move on while it is open", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			const before = yield* engine.getView();
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			return { before, after: yield* engine.getView() };
		} ) );

		expect( result.after.context.currentPlayer ).toBe( a );
		expect( result.after.context.turn ).toBe( result.before.context.turn );
	} );

	test( "the move's own events land alongside the frame", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			return yield* engine.getView();
		} ) );

		expect( result.view.log ).toEqual( [ "open:duel" ] );
	} );
} );


describe( "the deadline a frame opens with", () => {
	const deadlineOf = ( over: Partial<ParleyConfig>, kind: "duel" | "vote" = "duel" ) =>
		parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind }, playerId: a } );
			return yield* engine.getView();
		} ), over ).result.context.interactions[ 0 ]?.deadline;

	test( "is stamped from the config, since a game's execute has no clock", () => {
		const opened = Date.now();
		const deadline = deadlineOf( { interactionTimeoutMillis: 60_000 } )!;

		expect( deadline ).toBeGreaterThanOrEqual( opened + 60_000 );
		expect( deadline ).toBeLessThan( opened + 65_000 );
	} );

	test( "the interaction's own timeout wins over the config's", () => {
		const opened = Date.now();
		const deadline = deadlineOf( { interactionTimeoutMillis: 60_000 }, "vote" )!;

		expect( deadline ).toBeGreaterThanOrEqual( opened + 5_000 );
		expect( deadline ).toBeLessThan( opened + 10_000 );
	} );

	test( "a game that sets one itself keeps it", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel", deadline: 12_345 }, playerId: a } );
			return yield* engine.getView();
		} ), { interactionTimeoutMillis: 60_000 } );

		expect( result.context.interactions[ 0 ]?.deadline ).toBe( 12_345 );
	} );

	test( "with no timeout anywhere the frame never expires", () => {
		expect( deadlineOf( {} ) ).toBeUndefined();
	} );

	test( "the deadline rides the event, so a rebuild folds the same instant", () => {
		const { cells } = parley( engine => engine.open( { input: { kind: "duel" }, playerId: a } ), {
			interactionTimeoutMillis: 60_000
		} );

		const opened = commitsIn( cells )
			.flatMap( commit => commit.events )
			.find( event => event._tag === "swish/ev/InteractionOpened" ) as
			undefined | { frame: { deadline?: number } };

		expect( opened?.frame.deadline ).toBeNumber();
	} );
} );


describe( "who may answer a sequential frame", () => {
	const opened = <A, E>(
		body: ( engine: Effect.Success<typeof parleyEngine> ) => Effect.Effect<A, E>
	) => parley( engine => Effect.gen( function* () {
		yield* engine.open( { input: { kind: "duel" }, playerId: a } );
		return yield* body( engine );
	} ) );

	test( "the next responder in order", () => {
		const { result } = opened( engine => Effect.gen( function* () {
			yield* engine.reply( { input: { value: true }, playerId: b } );
			return yield* engine.getView();
		} ) );

		expect( topFrame( result.context.interactions )?.responses ).toEqual( {
			[ b ]: { value: true }
		} );
	} );

	test( "and nobody further down the list", () => {
		const { result } = opened( engine => engine.reply( {
			input: { value: true },
			playerId: c
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "not the player who opened it", () => {
		const { result } = opened( engine => engine.reply( {
			input: { value: true },
			playerId: a
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "and not the same responder twice", () => {
		const { result } = opened( engine => Effect.gen( function* () {
			yield* engine.reply( { input: { value: true }, playerId: b } );
			return yield* engine.reply( { input: { value: false }, playerId: b } ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "answers accumulate in order until the frame is full", () => {
		const { result } = opened( engine => Effect.gen( function* () {
			yield* engine.reply( { input: { value: true }, playerId: b } );
			yield* engine.reply( { input: { value: false }, playerId: c } );
			return yield* engine.getView();
		} ) );

		expect( Object.keys( topFrame( result.context.interactions )?.responses ?? {} ) )
			.toEqual( [ b, c ] );
	} );
} );


describe( "who may answer a simultaneous frame", () => {
	const opened = <A, E>(
		body: ( engine: Effect.Success<typeof parleyEngine> ) => Effect.Effect<A, E>
	) => parley( engine => Effect.gen( function* () {
		yield* engine.open( { input: { kind: "vote" }, playerId: a } );
		return yield* body( engine );
	} ) );

	test( "any responder, in any order", () => {
		const { result } = opened( engine => Effect.gen( function* () {
			yield* engine.reply( { input: { value: true }, playerId: d } );
			return yield* engine.getView();
		} ) );

		expect( topFrame( result.context.interactions )?.responses ).toEqual( {
			[ d ]: { value: true }
		} );
	} );

	test( "but only once each", () => {
		const { result } = opened( engine => Effect.gen( function* () {
			yield* engine.reply( { input: { value: true }, playerId: d } );
			return yield* engine.reply( { input: { value: false }, playerId: d } ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "and never the initiator", () => {
		const { result } = opened( engine => engine.reply( {
			input: { value: true },
			playerId: a
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );
} );


describe( "a frame that names its own responder", () => {
	const audited = <A, E>(
		body: ( engine: Effect.Success<typeof parleyEngine> ) => Effect.Effect<A, E>
	) => parley( engine => Effect.gen( function* () {
		yield* engine.open( { input: { kind: "audit" }, playerId: a } );
		return yield* body( engine );
	} ) );

	test( "the named player answers, though they are not next in order", () => {
		// `audit` names its second responder, so `c` answers ahead of `b`.
		const { result } = audited( engine => Effect.gen( function* () {
			const before = yield* engine.getView();
			yield* engine.reply( { input: { value: true }, playerId: c } );
			return {
				target: topFrame( before.context.interactions )?.target,
				after: yield* engine.getView()
			};
		} ) );

		expect( result.target ).toBe( c );
		expect( result.after.view.log ).toContain( `reply:${ c }:true` );
	} );

	test( "and the one who would otherwise be next is refused", () => {
		const { result } = audited( engine => engine.reply( {
			input: { value: true },
			playerId: b
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );
} );


describe( "the moves a frame routes", () => {
	test( "refuses a move that is not a response to it", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			return yield* engine.pass( { input: {}, playerId: b } ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
		expect( ( result as { move: string } ).move ).toBe( "pass" );
	} );

	test( "refuses it from the current player too — the frame outranks the turn", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			return yield* engine.pass( { input: {}, playerId: a } ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "a response still runs the move's own validation", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			return yield* engine.reply( {
				input: { value: true, token: "bad" },
				playerId: b
			} ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as { reason: string } ).reason ).toBe( "That token is refused." );
	} );

	test( "a refused response leaves the frame untouched", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			yield* engine.reply( { input: { value: true, token: "bad" }, playerId: b } ).pipe( Effect.flip );
			return yield* engine.getView();
		} ) );

		expect( topFrame( result.context.interactions )?.responses ).toEqual( {} );
	} );

	test( "the response move outside any frame is just a move, and validates as one", () => {
		const { result } = parley( engine => engine.reply( {
			input: { value: true },
			playerId: a
		} ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as { reason: string } ).reason ).toBe( "Nothing to reply to." );
	} );
} );


describe( "resolving a frame", () => {
	test( "settles once every responder has answered", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
			yield* engine.reply( { input: { value: false }, playerId: d } );
			return yield* engine.getView();
		} ) );

		expect( result.context.interactions ).toEqual( [] );
		expect( result.view.log ).toContain( "resolved:duel:2" );
	} );

	test( "an interaction may settle early on its own rule", () => {
		// `vote` resolves on two answers, so `d` never has to be waited on.
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "vote" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
			return yield* engine.getView();
		} ) );

		expect( result.context.interactions ).toEqual( [] );
		expect( result.view.log ).toContain( "resolved:vote:2" );
	} );

	test( "the last response and the resolution land in one commit", () => {
		const { cells } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "audit" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
		} ) );

		const tags = commitsIn( cells ).at( -1 )?.events.map( event => event._tag ) ?? [];

		expect( tags ).toContain( "swish/ev/InteractionResponded" );
		expect( tags ).toContain( "swish/ev/InteractionResolved" );
		expect( tags ).toContain( "swish/ev/TurnAdvanced" );
	} );

	test( "the turn advances from whoever opened the frame, not whoever answered last", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
			yield* engine.reply( { input: { value: true }, playerId: d } );
			return yield* engine.getView();
		} ) );

		// `a` opened it, so the turn is `a`'s to hand on — the seat after `a`.
		expect( result.context.currentPlayer ).toBe( b );
		expect( result.context.turn ).toBe( 1 );
	} );

	test( "the turn stays put until the frame settles", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			return yield* engine.getView();
		} ) );

		expect( result.context.currentPlayer ).toBe( a );
		expect( result.context.turn ).toBe( 0 );
	} );

	test( "a resolution can be what ends the game", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "audit" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
			return yield* engine.getView();
		} ), { target: 1 } );

		expect( result.status ).toBe( "COMPLETED" );
	} );

	test( "play carries on normally once the stack is empty", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "audit" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
			yield* engine.pass( { input: {}, playerId: b } );
			return yield* engine.getView();
		} ) );

		expect( result.view.log ).toContain( `pass:${ b }` );
		expect( result.context.currentPlayer ).toBe( c );
	} );
} );


describe( "a frame of a kind the game does not declare", () => {
	test( "no response is routed to it", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "ghost" }, playerId: a } );
			return yield* engine.reply( { input: { value: true }, playerId: b } ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "and it stops the stack unwinding past it", () => {
		// The duel above it settles; the frame beneath has no definition, so the
		// engine stops there rather than guessing at how to resolve it.
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "duel", beneath: true }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
			yield* engine.reply( { input: { value: true }, playerId: d } );
			return yield* engine.getView();
		} ) );

		expect( result.context.interactions.map( frame => frame.kind ) ).toEqual( [ "ghost" ] );
		expect( result.view.log ).toContain( "resolved:duel:3" );
		// The turn is still held, since the stack never emptied.
		expect( result.context.turn ).toBe( 0 );
	} );
} );


describe( "a resolution that opens another frame", () => {
	/** Answers the opening duel in full, which is what makes it resolve. */
	const nested = <A, E>(
		body: ( engine: Effect.Success<typeof parleyEngine> ) => Effect.Effect<A, E>,
		over: Partial<ParleyConfig> = {}
	) => parley( engine => Effect.gen( function* () {
		yield* engine.open( { input: { kind: "duel", nest: true }, playerId: a } );
		yield* engine.reply( { input: { value: false }, playerId: b } );
		yield* engine.reply( { input: { value: false }, playerId: c } );
		yield* engine.reply( { input: { value: false }, playerId: d } );
		return yield* body( engine );
	} ), over );

	test( "the frame it opened is what the table is left waiting on", () => {
		const { result } = nested( engine => engine.getView() );

		expect( result.context.interactions.map( frame => frame.kind ) ).toEqual( [ "vote" ] );
		expect( result.view.log ).toContain( "nested" );
	} );

	test( "the frame it resolved is gone, and is never resolved twice", () => {
		const { result } = nested( engine => engine.getView() );

		expect( result.view.log.filter( entry => entry === "nested" ) ).toHaveLength( 1 );
		expect( result.view.log.some( entry => entry.startsWith( "resolved:duel" ) ) ).toBe( false );
	} );

	test( "the turn is suspended rather than advanced", () => {
		const { result } = nested( engine => engine.getView() );

		expect( result.context.currentPlayer ).toBe( a );
		expect( result.context.turn ).toBe( 0 );
	} );

	test( "the nested frame routes responses of its own", () => {
		const { result } = nested( engine => Effect.gen( function* () {
			yield* engine.reply( { input: { value: true }, playerId: d } );
			return yield* engine.getView();
		} ) );

		expect( topFrame( result.context.interactions )?.responses ).toEqual( {
			[ d ]: { value: true }
		} );
	} );

	test( "settling it unwinds the stack and hands the turn on at last", () => {
		const { result } = nested( engine => Effect.gen( function* () {
			// `vote` settles on two answers of its own.
			yield* engine.reply( { input: { value: true }, playerId: b } );
			yield* engine.reply( { input: { value: true }, playerId: c } );
			return yield* engine.getView();
		} ) );

		expect( result.context.interactions ).toEqual( [] );
		expect( result.view.log ).toContain( "resolved:vote:2" );
		// The turn was always the opening frame's initiator's to hand on.
		expect( result.context.currentPlayer ).toBe( b );
		expect( result.context.turn ).toBe( 1 );
	} );

	test( "the handover and the frame it opened land in one commit", () => {
		const { cells } = nested( engine => engine.getView() );
		const tags = commitsIn( cells ).at( -1 )?.events.map( event => event._tag ) ?? [];

		// The parent closes before the child opens, which is the whole fix: the
		// other order would pop the child in the parent's place.
		expect( tags.lastIndexOf( "swish/ev/InteractionResolved" ) )
			.toBeLessThan( tags.lastIndexOf( "swish/ev/InteractionOpened" ) );
	} );

	test( "a rebuild from the log lands on the same stack", () => {
		// The events are what a replay folds, so the nesting has to survive one.
		const { result } = nested( engine => Effect.gen( function* () {
			const played = yield* engine.getView();
			yield* engine.undo( d );
			yield* engine.redo( d );
			return { played, rebuilt: yield* engine.getView() };
		} ) );

		expect( result.rebuilt.context.interactions ).toEqual( result.played.context.interactions );
		expect( result.rebuilt.view ).toEqual( result.played.view );
	} );

	test( "the nested frame runs a clock of its own", () => {
		const { result } = nested( engine => engine.getView(), {
			interactionTimeoutMillis: 60_000
		} );

		// `vote` overrides the config with five seconds, and the engine stamps that
		// onto the frame it was handed rather than the one that opened it.
		const deadline = topFrame( result.context.interactions )?.deadline;

		expect( deadline ).toBeGreaterThan( Date.now() );
		expect( deadline ).toBeLessThan( Date.now() + 10_000 );
	} );
} );

describe( "randomness at resolution", () => {
	/** The numbers a run's `draw` frames recorded, in the order they settled. */
	const drawsIn = ( log: ReadonlyArray<string> ) => log
		.filter( entry => entry.startsWith( "resolved:draw:" ) )
		.map( entry => Number( entry.slice( "resolved:draw:".length ) ) );

	test( "a resolution is handed a working rng", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "draw" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			return yield* engine.getView();
		} ) );

		const draws = drawsIn( result.view.log );

		expect( draws ).toHaveLength( 1 );
		expect( draws[ 0 ] ).toBeGreaterThanOrEqual( 0 );
		expect( draws[ 0 ] ).toBeLessThan( 1_000_000 );
	} );

	test( "two frames settled in one command draw different streams", () => {
		// Both settle inside the commit the reply lands in: the first hands off to
		// an `auto` frame the loop takes in the same pass. The command's version is
		// fixed across the pair, so only the per-settlement salt keeps them apart.
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "draw", nest: true }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			return yield* engine.getView();
		} ) );

		const draws = drawsIn( result.view.log );

		expect( draws ).toHaveLength( 2 );
		expect( draws[ 0 ] ).not.toBe( draws[ 1 ] );
	} );

	test( "the drawn value rides the events, so a replay folds the same one", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "draw", nest: true }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			const played = yield* engine.getView();
			yield* engine.undo( b );
			yield* engine.redo( b );
			return { played, rebuilt: yield* engine.getView() };
		} ) );

		expect( drawsIn( result.rebuilt.view.log ) ).toEqual( drawsIn( result.played.view.log ) );
	} );
} );

describe( "seating changes at resolution", () => {
	test( "a resolution may eliminate a seat", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "purge" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			return yield* engine.getView();
		} ) );

		// `purge` names its first responder, which is the seat after the initiator.
		expect( result.context.seats[ b ] ).toBe( "eliminated" );
		expect( result.view.log ).toContain( `resolved:purge:${ b }` );
	} );

	test( "the eliminated seat is skipped once the stack empties", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "purge" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			return yield* engine.getView();
		} ) );

		// The stack emptied, so the turn advanced from the frame's initiator — over
		// the seat the resolution had just knocked out.
		expect( result.context.currentPlayer ).toBe( c );
	} );

	test( "the elimination survives a replay", () => {
		const { result } = parley( engine => Effect.gen( function* () {
			yield* engine.open( { input: { kind: "purge" }, playerId: a } );
			yield* engine.reply( { input: { value: true }, playerId: b } );
			const played = yield* engine.getView();
			yield* engine.undo( b );
			yield* engine.redo( b );
			return { played, rebuilt: yield* engine.getView() };
		} ) );

		expect( result.rebuilt.context.seats ).toEqual( result.played.context.seats );
	} );
} );
