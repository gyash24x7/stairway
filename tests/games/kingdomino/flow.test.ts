import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import type { Table } from "@tests/harness/table";
import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { makeUsers } from "@tests/harness/users";

import { KINGDOMINO_DECK_SIZE, KINGDOMINO_DRAFT_SIZE } from "@/games/kingdomino/schema";
import {
	KingdominoEngine,
	KingdominoEngineLive,
	KingdominoStructure
} from "@/games/kingdomino/server/engine";
import { getValidPlacements } from "@/games/kingdomino/utils";


const Kingdomino = {
	Engine: KingdominoEngine,
	EngineLive: KingdominoEngineLive,
	Structure: KingdominoStructure
};

const TABLE = Object.values( makeUsers( [ "alice", "bob", "carol" ] as const ) );
const DUEL = TABLE.slice( 0, 2 );

type KingdominoTable = Table<typeof KingdominoStructure>;

const seated = ( name: string, players = TABLE, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Kingdomino, {
		players,
		name,
		config: { playerCount: players.length as 2 | 3 | 4, boardSize: 5, ...PARKED, ...config }
	} );

	yield* game.joinAll();
	return game;
} );

/** Claims the lowest unclaimed domino for whoever the cursor is on. */
const claimOne = ( game: KingdominoTable ) => Effect.gen( function* () {
	const view = yield* game.view();
	const seat = view.context.currentPlayer!;
	const open = view.view.draft.find( item => !item.selectedBy )!;

	yield* game.move( seat, "selectDomino", { dominoId: open.domino.id } );
	return seat;
} );

/** Lays (or gives up) the domino the cursor's seat owes. */
const layOne = ( game: KingdominoTable ) => Effect.gen( function* () {
	const view = yield* game.view();
	const seat = view.context.currentPlayer!;
	const player = view.view.playerData[ seat ]!;
	const owed = Math.min( ...player.queue );

	const options = getValidPlacements( player.board, owed );
	if ( options.length === 0 ) {
		yield* game.move( seat, "discardDomino", { dominoId: owed } );
		return seat;
	}

	yield* game.move( seat, "placeDomino", { placement: options[ 0 ]! } );
	return seat;
} );

/** Plays one full round: everyone claims, then everyone lays. */
const playRound = ( game: KingdominoTable ) => Effect.gen( function* () {
	const before = yield* game.view();
	const slots = before.view.selectionOrder.length;

	for ( let i = 0; i < slots; i++ ) {
		yield* claimOne( game );
	}

	for ( let i = 0; i < slots; i++ ) {
		if ( ( yield* game.view() ).status !== "IN_PROGRESS" ) {
			return;
		}

		yield* layOne( game );
	}
} );


describe( "kingdomino flow", () => {

	describe( "the table", () => {

		it.live(
			"lays out a kingdom per seat and turns the first row up",
			() => Effect.gen( function* () {
				const game = yield* seated( "table-start" );
				const view = yield* game.view();

				assert.strictEqual( view.status, "IN_PROGRESS" );
				assert.strictEqual( view.context.phase, "SELECT" );
				assert.strictEqual( Object.keys( view.view.playerData ).length, 3 );
				assert.strictEqual( view.view.draft.length, KINGDOMINO_DRAFT_SIZE );
				assert.strictEqual( view.view.deckCount, KINGDOMINO_DECK_SIZE - KINGDOMINO_DRAFT_SIZE );
			} )
		);

		it.live( "starts every kingdom with a castle and nothing else", () => Effect.gen( function* () {
			const game = yield* seated( "table-castles" );
			const view = yield* game.view();

			const castles = new Set<string>();
			for ( const player of Object.values( view.view.playerData ) ) {
				assert.deepStrictEqual( Object.keys( player.board.tiles ), [ "0,0" ] );
				assert.deepStrictEqual( [ ...player.queue ], [] );
				assert.strictEqual( player.score.points, 0 );
				castles.add( player.board.castle );
			}

			assert.strictEqual( castles.size, 3, "every seat gets its own colour" );
		} ) );

		it.live( "gives a table of three one slot each", () => Effect.gen( function* () {
			const game = yield* seated( "table-order-three" );
			const view = yield* game.view();

			assert.strictEqual( view.view.selectionOrder.length, 3 );
			assert.strictEqual( view.context.currentPlayer, view.view.selectionOrder[ 0 ] );
		} ) );

		it.live( "seats a duel twice over", () => Effect.gen( function* () {
			const game = yield* seated( "table-order-duel", DUEL );
			const view = yield* game.view();

			assert.strictEqual( view.view.selectionOrder.length, 4 );
			assert.strictEqual(
				view.view.selectionOrder.filter( id => id === "alice" ).length,
				2
			);
		} ) );

		it.live( "hides the deck's order but publishes its size", () => Effect.gen( function* () {
			const game = yield* seated( "table-deck" );

			const table = yield* game.state();
			const mine = yield* game.state( "alice" );

			assert.strictEqual( table.deckCount, mine.deckCount );
			assert.notProperty( table, "deck" );

			// Every kingdom is public, so the only thing that differs is `playerId`.
			assert.deepStrictEqual( { ...table, playerId: "alice" }, { ...mine } );
		} ) );
	} );

	describe( "the draft", () => {

		it.live( "refuses a claim out of turn", () => Effect.gen( function* () {
			const game = yield* seated( "draft-order" );
			const view = yield* game.view();
			const waiting = view.context.players.find( id => id !== view.context.currentPlayer )!;

			const tag = yield* rejectionTag( game.move( waiting, "selectDomino", {
				dominoId: view.view.draft[ 0 ]!.domino.id
			} ) );

			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );

		it.live( "refuses laying a domino during the draft", () => Effect.gen( function* () {
			const game = yield* seated( "draft-phase-gate" );
			const seat = ( yield* game.view() ).context.currentPlayer!;

			const tag = yield* rejectionTag( game.move( seat, "placeDomino", {
				placement: { dominoId: 1, coord: { x: 1, y: 0 }, rotation: 0 }
			} ) );

			assert.strictEqual( tag, "swish/MoveNotAllowed" );
		} ) );

		it.live( "marks the row and queues the domino", () => Effect.gen( function* () {
			const game = yield* seated( "draft-claim" );
			const before = yield* game.view();
			const first = before.view.draft[ 0 ]!.domino.id;
			const seat = before.context.currentPlayer!;

			yield* game.move( seat, "selectDomino", { dominoId: first } );

			const view = yield* game.view();
			assert.strictEqual( view.view.draft[ 0 ]?.selectedBy, seat );
			assert.deepStrictEqual( [ ...view.view.playerData[ seat ]!.queue ], [ first ] );
		} ) );

		it.live( "refuses a domino already claimed", () => Effect.gen( function* () {
			const game = yield* seated( "draft-taken" );
			const first = ( yield* game.view() ).view.draft[ 0 ]!.domino.id;

			yield* claimOne( game );

			const seat = ( yield* game.view() ).context.currentPlayer!;
			const tag = yield* rejectionTag(
				game.move( seat, "selectDomino", { dominoId: first } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live(
			"leaves the fourth domino unclaimed at a table of three",
			() => Effect.gen( function* () {
				const game = yield* seated( "draft-leftover" );
				const row = ( yield* game.view() ).view.draft.map( item => item.domino.id );

				for ( let i = 0; i < 3; i++ ) {
					yield* claimOne( game );
				}

				const view = yield* game.view();

				// Three claims settle the row; the one nobody wanted is out of the game
				// rather than shuffled back, which keeps the deck a fixed set of rows.
				assert.strictEqual( view.context.phase, "PLACE" );
				assert.strictEqual( view.view.draft.length, 3 );
				assert.notInclude( view.view.draft.map( item => item.domino.id ), row[ 3 ] );
			} )
		);

		it.live(
			"recomputes the next order off the claims, lowest first",
			() => Effect.gen( function* () {
				const game = yield* seated( "draft-reorder" );

				for ( let i = 0; i < 3; i++ ) {
					yield* claimOne( game );
				}

				const view = yield* game.view();
				const claimed = [ ...view.view.draft ]
					.sort( ( a, b ) => a.domino.id - b.domino.id )
					.map( item => item.selectedBy );

				assert.deepStrictEqual( [ ...view.view.selectionOrder ], claimed );
				assert.strictEqual( view.context.currentPlayer, claimed[ 0 ] );
			} )
		);
	} );

	describe( "placing", () => {

		const placing = ( name: string ) => Effect.gen( function* () {
			const game = yield* seated( name );
			for ( let i = 0; i < 3; i++ ) {
				yield* claimOne( game );
			}

			return game;
		} );

		it.live( "refuses claiming once the placing phase is on", () => Effect.gen( function* () {
			const game = yield* placing( "place-phase-gate" );
			const seat = ( yield* game.view() ).context.currentPlayer!;

			const tag = yield* rejectionTag(
				game.move( seat, "selectDomino", { dominoId: 1 } )
			);

			assert.strictEqual( tag, "swish/MoveNotAllowed" );
		} ) );

		it.live(
			"lays the domino and scores the kingdom in one commit",
			() => Effect.gen( function* () {
				const game = yield* placing( "place-lay" );
				const view = yield* game.view();
				const seat = view.context.currentPlayer!;
				const owed = view.view.playerData[ seat ]!.queue[ 0 ]!;

				const options = getValidPlacements( view.view.playerData[ seat ]!.board, owed );
				yield* game.move( seat, "placeDomino", { placement: options[ 0 ]! } );

				const after = yield* game.view();
				const player = after.view.playerData[ seat ]!;

				assert.strictEqual( Object.keys( player.board.tiles ).length, 3 );
				assert.strictEqual( player.board.placements.length, 1 );
				assert.deepStrictEqual( [ ...player.queue ], [] );
				assert.isDefined( player.score );
			} )
		);

		it.live( "refuses a placement that does not fit", () => Effect.gen( function* () {
			const game = yield* placing( "place-misfit" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const owed = view.view.playerData[ seat ]!.queue[ 0 ]!;

			const tag = yield* rejectionTag( game.move( seat, "placeDomino", {
				placement: { dominoId: owed, coord: { x: 4, y: 4 }, rotation: 0 }
			} ) );

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses giving up a domino that still fits", () => Effect.gen( function* () {
			// A discard reachable at will would be a free way out of an awkward claim.
			const game = yield* placing( "place-no-free-discard" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const owed = view.view.playerData[ seat ]!.queue[ 0 ]!;

			const tag = yield* rejectionTag(
				game.move( seat, "discardDomino", { dominoId: owed } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "makes a duel lay its lower claim first", () => Effect.gen( function* () {
			const game = yield* seated( "place-queue-order", DUEL );

			for ( let i = 0; i < 4; i++ ) {
				yield* claimOne( game );
			}

			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const queue = [ ...view.view.playerData[ seat ]!.queue ].sort( ( a, b ) => a - b );

			assert.strictEqual( queue.length, 2, "a duel holds both claims at once" );

			const options = getValidPlacements( view.view.playerData[ seat ]!.board, queue[ 1 ]! );
			const tag = yield* rejectionTag( game.move( seat, "placeDomino", {
				placement: options[ 0 ]!
			} ) );

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "turns back to a fresh row once every domino is laid", () => Effect.gen( function* () {
			const game = yield* seated( "place-round-over" );
			yield* playRound( game );

			const view = yield* game.view();
			assert.strictEqual( view.context.phase, "SELECT" );
			assert.strictEqual( view.view.draft.length, KINGDOMINO_DRAFT_SIZE );
			assert.strictEqual(
				view.view.deckCount,
				KINGDOMINO_DECK_SIZE - 2 * KINGDOMINO_DRAFT_SIZE
			);

			for ( const player of Object.values( view.view.playerData ) ) {
				assert.strictEqual( Object.keys( player.board.tiles ).length, 3 );
			}
		} ) );
	} );

	describe( "undo", () => {

		it.live( "takes a claim back, and the turn with it", () => Effect.gen( function* () {
			// The cursor counts the claims on the row rather than tracking an index,
			// so an undo that takes a claim back also takes the turn back.
			const game = yield* seated( "undo-claim" );
			const seat = ( yield* game.view() ).context.currentPlayer!;

			yield* claimOne( game );
			assert.notStrictEqual( ( yield* game.view() ).context.currentPlayer, seat );

			yield* game.undo( seat );

			const view = yield* game.view();
			assert.strictEqual( view.context.currentPlayer, seat );
			assert.isUndefined( view.view.draft[ 0 ]?.selectedBy );
			assert.deepStrictEqual( [ ...view.view.playerData[ seat ]!.queue ], [] );
		} ) );
	} );

	describe( "bots", () => {

		it.live( "plays a whole duel out to a ranking", () => Effect.gen( function* () {
			const game = yield* makeTable( Kingdomino, {
				players: DUEL,
				name: "bot-duel",
				config: {
					playerCount: 2,
					boardSize: 7,
					botDelayMillis: 1,
					moveTimeoutMillis: 20
				}
			} );

			yield* game.joinAll();

			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 120 )
			);

			assert.strictEqual( view.view.deckCount, 0 );
			assert.strictEqual( view.results?.ranking.length, 2 );

			for ( const player of Object.values( view.view.playerData ) ) {
				assert.deepStrictEqual( [ ...player.queue ], [], "nothing left in hand" );
				assert.isAbove( Object.keys( player.board.tiles ).length, 1 );
			}
		} ), 180_000 );
	} );
} );
