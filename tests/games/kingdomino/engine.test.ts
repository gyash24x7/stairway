import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { decideMove } from "@/games/kingdomino/server/bot.ts";
import { kingdomino } from "@/games/kingdomino/server/engine.ts";
import {
	KINGDOMINO_DECK_SIZE,
	KINGDOMINO_DRAFT_SIZE,
	KINGDOMINO_DEFAULT_BOARD_SIZE,
	KINGDOMINO_MOVE_TIMEOUT_MILLIS
} from "@/games/kingdomino/shared/schema.ts";
import { calculateScore, CASTLES, draftPlayerOrder } from "@/games/kingdomino/server/utils.ts";
import {
	canDominoBePlaced,
	createBoard,
	getDomino,
	getValidPlacements
} from "@/games/kingdomino/shared/utils.ts";
import { GameContext, PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { createInput, runGame, tagsIn, testClock } from "@tests/helpers/runner.ts";

import type {
	Board,
	BoardSize,
	KingdominoConfig,
	KingdominoView,
	Placement
} from "@/games/kingdomino/shared/schema.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ player( "a" ), player( "b" ), player( "c" ), player( "d" ) ];

const info = ( id: Player, isBot = false ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar", isBot } );

const configFor = (
	playerCount: 2 | 3 | 4,
	boardSize: BoardSize = KINGDOMINO_DEFAULT_BOARD_SIZE
): KingdominoConfig => ( {
	playerCount,
	boardSize,
	autoStart: false,
	moveTimeoutMillis: KINGDOMINO_MOVE_TIMEOUT_MILLIS
} );

/**
 * Seats a table by hand and starts it, which is how Kingdomino runs: `autoStart`
 * is off, so the creator says when the lobby closes.
 *
 * @param body - What to play once the game is under way.
 * @param [options] - The seats, who is a bot, the kingdom size and the clock.
 * @returns The run's result and collectors.
 */
const table = <A, E>(
	body: ( engine: Effect.Success<typeof kingdomino> ) => Effect.Effect<A, E>,
	options: {
		readonly seats?: ReadonlyArray<Player>;
		readonly bots?: ReadonlyArray<Player>;
		readonly boardSize?: BoardSize;
		readonly clock?: ReturnType<typeof testClock>;
	} = {}
) => {
	const seats = options.seats ?? [ a, b ];
	const clock = options.clock ?? testClock();
	const config = configFor( seats.length as 2 | 3 | 4, options.boardSize );

	return runGame( kingdomino, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( config, seats[ 0 ]! ) );
		for ( const seat of seats ) {
			yield* engine.join( info( seat, options.bots?.includes( seat ) ?? false ) );
		}

		yield* engine.start( seats[ 0 ]! );
		return yield* body( engine );
	} ), { now: clock.now } );
};

/** The view a seat holds right now. */
const viewOf = ( engine: Effect.Success<typeof kingdomino>, id?: Player ) =>
	( id ? engine.getState( id ) : engine.getState() ).pipe(
		Effect.map( envelope => envelope.view as KingdominoView )
	);

/** Claims the row in the order the game asks for, one seat at a time. */
const claimRow = ( engine: Effect.Success<typeof kingdomino> ) => Effect.gen( function* () {
	while ( true ) {
		const envelope = yield* engine.getState();
		if ( envelope.context.phase !== "SELECT" || envelope.status !== "IN_PROGRESS" ) {
			return envelope;
		}

		const seat = envelope.context.currentPlayer;
		const view = envelope.view as KingdominoView;
		const open = view.draft.find( entry => !entry.selectedBy )!;

		yield* engine.selectDomino( { dominoId: open.domino.id }, seat );
	}
} );

/** Plays whatever the policy would play for the seat the engine is waiting on. */
const policyMove = ( engine: Effect.Success<typeof kingdomino> ) => Effect.gen( function* () {
	const envelope = yield* engine.getState();
	const seat = envelope.context.currentPlayer;
	const view = ( yield* engine.getState( seat ) ).view as KingdominoView;
	const move = decideMove( view, envelope.context )!;

	switch ( move.moveType ) {
		case "selectDomino":
			return yield* engine.selectDomino( move.input, seat );
		case "placeDomino":
			return yield* engine.placeDomino( move.input, seat );
		case "discardDomino":
			return yield* engine.discardDomino( move.input, seat );
	}
} );

/** Runs the policy until the game is over, or until it plainly is not going to be. */
const playOut = ( engine: Effect.Success<typeof kingdomino> ) => Effect.gen( function* () {
	for ( let move = 0; move < 400; move++ ) {
		const envelope = yield* engine.getState();
		if ( envelope.status === "COMPLETED" ) {
			return envelope;
		}

		yield* policyMove( engine );
	}

	return yield* engine.getState();
} );


describe( "laying the table out", () => {
	test( "gives every seat a kingdom with its own castle at the origin", () => {
		const { result } = table( engine => viewOf( engine ), { seats: [ a, b, c, d ] } );

		const castles = [ a, b, c, d ].map( seat => result.playerData[ seat ]!.board.castle );

		expect( castles ).toEqual( [ ...CASTLES ] );
		for ( const seat of [ a, b, c, d ] ) {
			const board = result.playerData[ seat ]!.board;
			expect( board.size ).toBe( KINGDOMINO_DEFAULT_BOARD_SIZE );
			expect( board.tiles ).toEqual( { "0,0": { terrain: "castle", crowns: 0 } } );
			expect( result.playerData[ seat ]!.queue ).toEqual( [] );
			expect( result.playerData[ seat ]!.score.points ).toBe( 0 );
		}
	} );

	test( "shuffles the whole box and turns four face up, whatever the seat count", () => {
		for ( const seats of [ [ a, b ], [ a, b, c ], [ a, b, c, d ] ] as const ) {
			const { result } = table( engine => viewOf( engine ), { seats } );

			expect( result.draft ).toHaveLength( KINGDOMINO_DRAFT_SIZE );
			expect( result.deckCount ).toBe( KINGDOMINO_DECK_SIZE - KINGDOMINO_DRAFT_SIZE );
		}
	} );

	test( "deals the same box to a duel on the big board", () => {
		const { result } = table( engine => viewOf( engine ), { boardSize: 7 } );

		expect( result.deckCount ).toBe( KINGDOMINO_DECK_SIZE - KINGDOMINO_DRAFT_SIZE );
		expect( result.playerData[ a ]!.board.size ).toBe( 7 );
	} );

	test( "lays the row out lowest number first", () => {
		const { result } = table( engine => viewOf( engine ), { seats: [ a, b, c, d ] } );
		const ids = result.draft.map( entry => entry.domino.id );

		expect( ids ).toEqual( ids.toSorted( ( x, y ) => x - y ) );
	} );

	test( "draws the opening claim order with a slot for every pick", () => {
		const { result } = table( engine => viewOf( engine ), { seats: [ a, b, c ] } );

		expect( result.selectionOrder ).toHaveLength( 3 );
		expect( result.selectionOrder.toSorted() ).toEqual( [ a, b, c ] );
	} );

	test( "gives a duel two kings each", () => {
		const { result } = table( engine => viewOf( engine ) );

		expect( result.selectionOrder ).toHaveLength( 4 );
		expect( result.selectionOrder.filter( seat => seat === a ) ).toHaveLength( 2 );
		expect( result.selectionOrder.filter( seat => seat === b ) ).toHaveLength( 2 );
	} );

	test( "opens in the draft, with the first claimant on turn", () => {
		const { result } = table( engine => engine.getState() );
		const view = result.view as KingdominoView;

		expect( result.status ).toBe( "IN_PROGRESS" );
		expect( result.context.phase ).toBe( "SELECT" );
		expect( result.context.currentPlayer ).toBe( view.selectionOrder[ 0 ]! );
	} );

	test( "never puts the deck on the wire", () => {
		const { result } = table( engine => Effect.gen( function* () {
			return { own: yield* viewOf( engine, a ), spectator: yield* viewOf( engine ) };
		} ) );

		expect( result.own ).not.toHaveProperty( "deck" );
		expect( result.spectator ).not.toHaveProperty( "deck" );
		expect( result.own.deckCount ).toBe( result.spectator.deckCount );
	} );

	test( "shows every seat the same table, itself included", () => {
		const { result } = table( engine => Effect.gen( function* () {
			return {
				own: yield* viewOf( engine, a ),
				opponent: yield* viewOf( engine, b ),
				spectator: yield* viewOf( engine )
			};
		} ) );

		// Kingdoms are built face up, so the only difference between the three is
		// whose seat each was built for.
		expect( result.opponent.playerData ).toEqual( result.own.playerData );
		expect( result.spectator.draft ).toEqual( result.own.draft );
		expect( result.own.playerId ).toBe( a );
		expect( result.spectator.playerId ).toBeUndefined();
	} );
} );


describe( "claiming a domino", () => {
	test( "queues the domino and hands the turn to the next slot", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			const view = before.view as KingdominoView;
			const seat = before.context.currentPlayer;
			const [ open ] = view.draft;

			yield* engine.selectDomino( { dominoId: open!.domino.id }, seat );

			return { seat, order: view.selectionOrder, after: yield* engine.getState() };
		} ) );

		const after = result.after.view as KingdominoView;

		expect( after.draft[ 0 ]!.selectedBy ).toBe( result.seat );
		expect( after.playerData[ result.seat ]!.queue ).toEqual( [ after.draft[ 0 ]!.domino.id ] );
		expect( result.after.context.currentPlayer ).toBe( result.order[ 1 ]! );
	} );

	test( "refuses a claim out of turn", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const view = envelope.view as KingdominoView;
			const other = [ a, b ].find( seat => seat !== envelope.context.currentPlayer )!;

			return yield* engine.selectDomino( { dominoId: view.draft[ 0 ]!.domino.id }, other )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "refuses a domino somebody has already claimed", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const view = envelope.view as KingdominoView;
			const taken = view.draft[ 0 ]!.domino.id;

			yield* engine.selectDomino( { dominoId: taken }, envelope.context.currentPlayer );

			const next = yield* engine.getState();
			return yield* engine.selectDomino( { dominoId: taken }, next.context.currentPlayer )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a domino that is not in the row", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const view = envelope.view as KingdominoView;
			const offered = view.draft.map( entry => entry.domino.id );
			const absent = Array.from( { length: KINGDOMINO_DECK_SIZE }, ( _, i ) => i + 1 )
				.find( id => !offered.includes( id ) )!;

			return yield* engine.selectDomino( { dominoId: absent }, envelope.context.currentPlayer )
				.pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a domino number the box does not hold, at the decode boundary", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			return yield* engine.selectDomino(
				{ dominoId: KINGDOMINO_DECK_SIZE + 1 },
				envelope.context.currentPlayer
			).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "will not let a seat claim more than its share of the row", () => {
		// Both of a duel's kings on the same seat, played out of order, would be the
		// only way past the turn gate — so the cap is asserted against the rule
		// itself rather than through the turn.
		const { result } = table( engine => Effect.gen( function* () {
			for ( let claim = 0; claim < 2; claim++ ) {
				const envelope = yield* engine.getState();
				const view = envelope.view as KingdominoView;
				const open = view.draft.find( entry => !entry.selectedBy )!;
				yield* engine.selectDomino( { dominoId: open.domino.id }, envelope.context.currentPlayer );
			}

			const envelope = yield* engine.getState();
			const view = envelope.view as KingdominoView;
			const seated = view.draft.filter( entry => entry.selectedBy === a );

			return { claims: seated.length, order: view.selectionOrder };
		} ) );

		// Whoever the shuffle gave two consecutive kings claimed twice; either way
		// nobody claimed more slots than the order gave them.
		expect( result.claims ).toBeLessThanOrEqual( 2 );
		expect( result.order.filter( seat => seat === a ) ).toHaveLength( 2 );
	} );

	test( "moves to the placement phase once the row is claimed out", () => {
		const { result } = table( engine => claimRow( engine ) );
		const view = result.view as KingdominoView;
		const order = draftPlayerOrder( view.draft );

		expect( result.context.phase ).toBe( "PLACE" );
		expect( view.draft.every( entry => !!entry.selectedBy ) ).toBe( true );
		// The lowest domino of the row lays first.
		expect( result.context.currentPlayer ).toBe( order[ 0 ]! );
	} );
} );


describe( "laying a domino", () => {
	/** A table already through its first draft, waiting on the first placement. */
	const placing = <A, E>(
		body: ( engine: Effect.Success<typeof kingdomino> ) => Effect.Effect<A, E>,
		seats?: ReadonlyArray<Player>
	) => table( engine => Effect.gen( function* () {
		yield* claimRow( engine );
		return yield* body( engine );
	} ), { seats } );

	test( "lands the domino, scores the kingdom and moves the turn on", () => {
		const { result } = placing( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const seat = envelope.context.currentPlayer;
			const view = envelope.view as KingdominoView;
			const dominoId = Math.min( ...view.playerData[ seat ]!.queue );
			const [ placement ] = getValidPlacements( view.playerData[ seat ]!.board, dominoId );

			yield* engine.placeDomino( { placement: placement! }, seat );

			return { seat, dominoId, after: yield* engine.getState() };
		} ) );

		const after = result.after.view as KingdominoView;
		const board = after.playerData[ result.seat ]!.board;

		expect( Object.keys( board.tiles ) ).toHaveLength( 3 );
		expect( board.placements ).toHaveLength( 1 );
		expect( after.playerData[ result.seat ]!.queue ).not.toContain( result.dominoId );
		expect( after.playerData[ result.seat ]!.score ).toBeDefined();
	} );

	test( "refuses a placement that touches nothing", () => {
		const { result } = placing( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const seat = envelope.context.currentPlayer;
			const view = envelope.view as KingdominoView;
			const dominoId = Math.min( ...view.playerData[ seat ]!.queue );

			return yield* engine.placeDomino( {
				placement: { dominoId, coord: { x: 3, y: 3 }, rotation: 0 }
			}, seat ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a placement outside the coordinates a kingdom can reach", () => {
		const { result } = placing( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const seat = envelope.context.currentPlayer;
			const view = envelope.view as KingdominoView;
			const dominoId = Math.min( ...view.playerData[ seat ]!.queue );

			return yield* engine.placeDomino( {
				placement: { dominoId, coord: { x: 400, y: 0 }, rotation: 0 }
			}, seat ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a domino the seat is not holding", () => {
		const { result } = placing( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const seat = envelope.context.currentPlayer;
			const view = envelope.view as KingdominoView;
			const held = view.playerData[ seat ]!.queue;
			const other = Array.from( { length: KINGDOMINO_DECK_SIZE }, ( _, i ) => i + 1 )
				.find( id => !held.includes( id ) )!;

			return yield* engine.placeDomino( {
				placement: { dominoId: other, coord: { x: 1, y: 0 }, rotation: 0 }
			}, seat ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "lets a seat lay while it is not the one being waited on", () => {
		const { result } = placing( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const seat = envelope.context.currentPlayer;
			const other = [ a, b ].find( id => id !== seat )!;
			const view = envelope.view as KingdominoView;
			const dominoId = Math.min( ...view.playerData[ other ]!.queue );
			const [ placement ] = getValidPlacements( view.playerData[ other ]!.board, dominoId );

			// A kingdom is the seat's own business — nothing it lays can reach
			// another one — so laying is simultaneous and `currentPlayer` is only
			// ever advisory through this phase.
			yield* engine.placeDomino( { placement: placement! }, other );

			return { other, after: yield* engine.getState() };
		} ) );

		const view = result.after.view as KingdominoView;

		expect( view.playerData[ result.other ]!.board.placements ).toHaveLength( 1 );
		expect( view.playerData[ result.other ]!.queue )
			.not.toContain( view.playerData[ result.other ]!.board.placements[ 0 ]!.dominoId );
	} );

	test( "refuses a discard while the domino can still be laid", () => {
		const { result } = placing( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const seat = envelope.context.currentPlayer;
			const view = envelope.view as KingdominoView;

			return yield* engine.discardDomino(
				{ dominoId: Math.min( ...view.playerData[ seat ]!.queue ) },
				seat
			).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "makes a duel lay its two dominoes in the order it claimed them", () => {
		const { result } = placing( engine => Effect.gen( function* () {
			const envelope = yield* engine.getState();
			const seat = envelope.context.currentPlayer;
			const view = envelope.view as KingdominoView;
			const queue = view.playerData[ seat ]!.queue;

			// A duel gives every seat two kings, so both are holding two dominoes.
			const dominoId = Math.max( ...queue );
			const [ placement ] = getValidPlacements( view.playerData[ seat ]!.board, dominoId );

			return {
				held: queue.length,
				error: yield* engine.placeDomino( { placement: placement! }, seat ).pipe( Effect.flip )
			};
		} ) );

		expect( result.held ).toBe( 2 );
		expect( result.error._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "starts the next round in the order the row was claimed", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* claimRow( engine );

			const placed = yield* engine.getState();
			const order = draftPlayerOrder( ( placed.view as KingdominoView ).draft );

			// Play the round out with the policy, which lays every claimed domino.
			for ( let move = 0; move < 8; move++ ) {
				const envelope = yield* engine.getState();
				if ( envelope.context.phase !== "PLACE" ) {
					break;
				}

				yield* policyMove( engine );
			}

			return { order, after: yield* engine.getState() };
		} ) );

		const after = result.after.view as KingdominoView;

		expect( result.after.context.phase ).toBe( "SELECT" );
		expect( after.selectionOrder ).toEqual( result.order );
		expect( result.after.context.currentPlayer ).toBe( result.order[ 0 ]! );
		// A fresh row, nobody having claimed any of it.
		expect( after.draft.every( entry => !entry.selectedBy ) ).toBe( true );
	} );
} );


describe( "playing a game out", () => {
	test( "runs a duel to the end of the deck and ranks the kingdoms", () => {
		const { result, saved } = table( engine => playOut( engine ) );
		const view = result.view as KingdominoView;

		expect( result.status ).toBe( "COMPLETED" );
		expect( view.deckCount ).toBe( 0 );

		for ( const seat of [ a, b ] ) {
			const data = view.playerData[ seat ]!;
			expect( data.queue ).toEqual( [] );
			// Twelve dominoes each, less anything that had to be discarded.
			expect( data.board.placements.length ).toBeLessThanOrEqual( 12 );
			expect( Object.keys( data.board.tiles ).length )
				.toBe( ( data.board.placements.length * 2 ) + 1 );
		}

		const ranks = result.results!.ranking.map( standing => standing.rank );

		expect( result.results!.ranking ).toHaveLength( 2 );
		// Either one seat ahead, or the rulebook's shared victory.
		expect( ranks ).toEqual( ranks[ 1 ] === 1 ? [ 1, 1 ] : [ 1, 2 ] );
		expect( saved.get( "kingdomino:game-1" ) ).toBeDefined();
	} );

	test( "plays every domino it dealt, and stops on the round that spends them", () => {
		const { result, cells } = table( engine => playOut( engine ) );
		const rounds = KINGDOMINO_DECK_SIZE / KINGDOMINO_DRAFT_SIZE;
		const tags = tagsIn( cells );

		const count = ( tag: string ) => tags.filter( t => t === tag ).length;

		expect( result.status ).toBe( "COMPLETED" );

		// A duel claims all four of every row, so the whole box is taken and every
		// claim is resolved. Off by a row either way would mean a round was drawn
		// and never played, or the game ended while a row was still on the table.
		expect( count( "kingdomino/ev/DraftDrawn" ) ).toBe( rounds );
		expect( count( "kingdomino/ev/DominoSelected" ) ).toBe( KINGDOMINO_DECK_SIZE );
		expect( count( "kingdomino/ev/DominoPlaced" ) + count( "kingdomino/ev/DominoDiscarded" ) )
			.toBe( KINGDOMINO_DECK_SIZE );
		expect( count( "kingdomino/ev/DraftPruned" ) ).toBe( 0 );
	} );

	test( "leaves one behind every round at a table of three, and never plays it", () => {
		const { result, cells } = table( engine => playOut( engine ), { seats: [ a, b, c ] } );
		const rounds = KINGDOMINO_DECK_SIZE / KINGDOMINO_DRAFT_SIZE;
		const tags = tagsIn( cells );

		const count = ( tag: string ) => tags.filter( t => t === tag ).length;

		expect( result.status ).toBe( "COMPLETED" );
		expect( count( "kingdomino/ev/DraftDrawn" ) ).toBe( rounds );
		expect( count( "kingdomino/ev/DraftPruned" ) ).toBe( rounds );

		// Three claims a round, and the fourth is out of the game rather than
		// shuffled back — so the box is spent in the same twelve rows.
		expect( count( "kingdomino/ev/DominoSelected" ) ).toBe( rounds * 3 );
		expect( count( "kingdomino/ev/DominoPlaced" ) + count( "kingdomino/ev/DominoDiscarded" ) )
			.toBe( rounds * 3 );
	} );

	test( "scores every seat off its own kingdom", () => {
		const { result } = table( engine => playOut( engine ) );
		const view = result.view as KingdominoView;

		for ( const standing of result.results!.ranking ) {
			expect( standing.score ).toBe( view.playerData[ standing.playerId ]!.score.points );
		}
	} );

	test( "ranks best first, and names a winner unless the top is shared", () => {
		const { result } = table( engine => playOut( engine ), { seats: [ a, b, c ] } );
		const ranking = result.results!.ranking;

		expect( result.status ).toBe( "COMPLETED" );
		expect( ranking ).toHaveLength( 3 );

		for ( let index = 1; index < ranking.length; index++ ) {
			expect( ranking[ index ]!.score! ).toBeLessThanOrEqual( ranking[ index - 1 ]!.score! );
			expect( ranking[ index ]!.rank ).toBeGreaterThanOrEqual( ranking[ index - 1 ]!.rank );
		}

		const shared = ranking.filter( standing => standing.rank === 1 ).length > 1;
		expect( result.results!.winner ).toBe( shared ? undefined : ranking[ 0 ]!.playerId );
	} );

	test( "runs a full table of four out the same way", () => {
		const { result } = table( engine => playOut( engine ), { seats: [ a, b, c, d ] } );
		const view = result.view as KingdominoView;

		expect( result.status ).toBe( "COMPLETED" );
		expect( view.deckCount ).toBe( 0 );
		expect( result.results!.ranking ).toHaveLength( 4 );
	} );

	test( "fills a 7x7 duel's kingdoms with twice the dominoes", () => {
		const { result } = table( engine => playOut( engine ), { boardSize: 7 } );
		const view = result.view as KingdominoView;

		expect( result.status ).toBe( "COMPLETED" );
		expect( view.playerData[ a ]!.board.placements.length ).toBeLessThanOrEqual( 24 );

		for ( const seat of [ a, b ] ) {
			for ( const key of Object.keys( view.playerData[ seat ]!.board.tiles ) ) {
				const [ x, y ] = key.split( "," ).map( Number );
				expect( x! ).toBeGreaterThanOrEqual( 0 );
				expect( x! ).toBeLessThan( 7 );
				expect( y! ).toBeGreaterThanOrEqual( 0 );
				expect( y! ).toBeLessThan( 7 );
			}
		}
	} );

	test( "never lets a kingdom outgrow its window", () => {
		const { result } = table( engine => playOut( engine ) );
		const view = result.view as KingdominoView;

		for ( const seat of [ a, b ] ) {
			for ( const key of Object.keys( view.playerData[ seat ]!.board.tiles ) ) {
				const [ x, y ] = key.split( "," ).map( Number );
				expect( x! ).toBeGreaterThanOrEqual( 0 );
				expect( x! ).toBeLessThan( KINGDOMINO_DEFAULT_BOARD_SIZE );
				expect( y! ).toBeGreaterThanOrEqual( 0 );
				expect( y! ).toBeLessThan( KINGDOMINO_DEFAULT_BOARD_SIZE );
			}
		}
	} );
} );


describe( "the policy", () => {
	/** A view holding one seat, its kingdom and whatever row is on offer. */
	const seatView = (
		board: Board,
		queue: ReadonlyArray<number>,
		draft: ReadonlyArray<{ id: number; by?: Player }> = []
	): KingdominoView => ( {
		playerData: { [ a ]: { board, queue, score: calculateScore( board ) } },
		draft: draft.map( entry => ( { domino: getDomino( entry.id )!, selectedBy: entry.by } ) ),
		selectionOrder: [ a ],
		deckCount: 0,
		playerId: a
	} );

	const contextIn = ( phase: string ) => GameContext.make( {
		turn: 0,
		players: [ a ],
		currentPlayer: a,
		phase,
		interactions: [],
		seats: {},
		teams: {},
		teamNames: {}
	} );

	test( "claims the most crowned domino left on the row", () => {
		// 48 is the three-crown mine, 1 is a bare field, 40 carries one crown.
		const view = seatView( createBoard( "red", 5 ), [], [
			{ id: 1 },
			{ id: 40 },
			{ id: 48 },
			{ id: 3, by: b }
		] );

		expect( decideMove( view, contextIn( "SELECT" ) ) )
			.toEqual( { moveType: "selectDomino", input: { dominoId: 48 } } );
	} );

	test( "never claims a domino somebody already took", () => {
		const view = seatView( createBoard( "red", 5 ), [], [ { id: 48, by: b }, { id: 1 } ] );

		expect( decideMove( view, contextIn( "SELECT" ) ) )
			.toEqual( { moveType: "selectDomino", input: { dominoId: 1 } } );
	} );

	test( "lays the lowest domino it holds, somewhere the rules accept", () => {
		const view = seatView( createBoard( "red", 5 ), [ 20, 7 ] );
		const move = decideMove( view, contextIn( "PLACE" ) )!;

		expect( move.moveType ).toBe( "placeDomino" );

		const { placement } = move.input as { placement: Placement };
		expect( placement.dominoId ).toBe( 7 );
		expect( canDominoBePlaced( view.playerData[ a ]!.board, placement ) ).toBe( true );
	} );

	test( "discards only when the kingdom has nowhere left to put it", () => {
		const filled: Board = {
			size: 5,
			castle: "red",
			placements: [],
			tiles: Object.fromEntries( Array.from( { length: 25 }, ( _, i ) => [
				`${ i % 5 },${ Math.floor( i / 5 ) }`,
				i === 0
					? { terrain: "castle" as const, crowns: 0 }
					: { terrain: "desert" as const, crowns: 0 }
			] ) )
		};

		const view = seatView( filled, [ 7 ] );

		expect( getValidPlacements( filled, 7 ) ).toEqual( [] );
		expect( decideMove( view, contextIn( "PLACE" ) ) )
			.toEqual( { moveType: "discardDomino", input: { dominoId: 7 } } );
	} );
} );


describe( "history and scheduling", () => {
	test( "takes back the claim a seat just made", () => {
		const { result } = table( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			const seat = before.context.currentPlayer;
			const view = before.view as KingdominoView;

			yield* engine.selectDomino( { dominoId: view.draft[ 0 ]!.domino.id }, seat );
			yield* engine.undo( seat );

			return { seat, after: yield* engine.getState() };
		} ) );

		const after = result.after.view as KingdominoView;

		expect( after.draft.every( entry => !entry.selectedBy ) ).toBe( true );
		expect( after.playerData[ result.seat ]!.queue ).toEqual( [] );
		expect( result.after.context.currentPlayer ).toBe( result.seat );
	} );

	test( "hands a seat to the policy on request, since the game declares one", () => {
		const { result } = table( engine => Effect.gen( function* () {
			yield* engine.setAutoPlay( a, true );
			return yield* engine.getState();
		} ) );

		expect( result.autoPlay[ a ] ).toBe( true );
	} );

	test( "plays a bot seat's turn when its delay comes due", () => {
		const clock = testClock();

		const { result } = table( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			const view = before.view as KingdominoView;

			// Whoever the shuffle put first is a bot either way — both seats are.
			clock.advance( 10_000 );
			yield* engine.alarm();

			return { before: view, after: yield* engine.getState() };
		} ), { bots: [ a, b ], clock } );

		const after = result.after.view as KingdominoView;

		expect( after.draft.filter( entry => !!entry.selectedBy ) ).toHaveLength( 1 );
		expect( result.after.context.currentPlayer )
			.toBe( result.before.selectionOrder[ 1 ]! );
	} );
} );
