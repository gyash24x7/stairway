import { assert, describe, it } from "@effect/vitest";

import { atPosition } from "@tests/harness/position";

import type { Castle, KingdominoConfig, KingdominoState } from "@/games/kingdomino/schema";
import {
	KingdominoConfig as Config,
	KINGDOMINO_DECK_SIZE,
	KINGDOMINO_DRAFT_SIZE
} from "@/games/kingdomino/schema";
import { KingdominoStructure } from "@/games/kingdomino/server/engine";
import { createBoard, DOMINO_DECK, getDomino, getValidPlacements } from "@/games/kingdomino/utils";
import type { PlayerId } from "@/swish/schema";
import { PlayerAudience, TableAudience } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;

const config = ( overrides: Partial<KingdominoConfig> = {} ): KingdominoConfig => Config.make( {
	playerCount: 3,
	boardSize: 5,
	autoStart: true,
	botDelayMillis: 5_000,
	moveTimeoutMillis: 120_000,
	...overrides
} );

const seat = ( queue: ReadonlyArray<number> = [], castle: Castle = "red" ) => ( {
	board: createBoard( castle, 5 ),
	queue,
	score: { regions: [], points: 0 }
} );

const entry = ( id: number, selectedBy?: PlayerId ) => ( {
	domino: getDomino( id )!,
	selectedBy
} );

const at = (
	state: Partial<KingdominoState> = {},
	phase = "SELECT",
	current: PlayerId = alice,
	players: ReadonlyArray<PlayerId> = [ alice, bob, carol ]
) => atPosition( KingdominoStructure, {
	state: {
		playerData: Object.fromEntries( players.map( ( id, i ) => [
			id,
			seat( [], [ "red", "blue", "green" ][ i ] as Castle )
		] ) ),
		deck: [],
		draft: [],
		selectionOrder: [],
		...state
	},
	config: config( { playerCount: Math.min( 4, Math.max( 2, players.length ) ) as 2 | 3 | 4 } ),
	context: { players, currentPlayer: current, phase, turn: 0 }
} );

const tags = ( events: ReadonlyArray<unknown> ) =>
	events.map( event => ( event as { _tag: string } )._tag );


describe( "kingdomino rules", () => {

	describe( "onStart", () => {

		it( "shuffles the box, builds a kingdom per seat, and fixes the opening order", () => {
			const game = at();
			const events = game.onStart();

			assert.deepStrictEqual( tags( events ), [
				"kingdomino/ev/DeckShuffled",
				"kingdomino/ev/PlayerBoardCreated",
				"kingdomino/ev/PlayerBoardCreated",
				"kingdomino/ev/PlayerBoardCreated",
				"kingdomino/ev/SelectionOrderSet"
			] );

			game.apply( ...events );
			assert.strictEqual( game.state.deck.length, KINGDOMINO_DECK_SIZE );
			assert.strictEqual( Object.keys( game.state.playerData ).length, 3 );
		} );

		it( "gives every seat a different castle", () => {
			const game = at();
			game.apply( ...game.onStart() );

			const castles = Object.values( game.state.playerData ).map( data => data.board.castle );
			assert.strictEqual( new Set( castles ).size, 3 );
		} );

		it( "gives a table of three one slot each", () => {
			const game = at();
			game.apply( ...game.onStart() );

			assert.strictEqual( game.state.selectionOrder.length, 3 );
			assert.deepStrictEqual(
				[ ...game.state.selectionOrder ].sort(),
				[ alice, bob, carol ].sort()
			);
		} );

		it( "seats a table of two twice over, no special case", () => {
			// A slot per king rather than a seat per player is what makes the duel
			// work without a branch: each seat appears twice and the four are
			// shuffled together, exactly as the kings are dropped on the first row.
			const game = at( {}, "SELECT", alice, [ alice, bob ] );
			game.apply( ...game.onStart() );

			assert.strictEqual( game.state.selectionOrder.length, 4 );
			assert.strictEqual(
				game.state.selectionOrder.filter( id => id === alice ).length,
				2
			);
		} );

		it( "shuffles the box rather than dealing it in order", () => {
			const game = at();
			game.apply( ...game.onStart() );

			assert.notDeepEqual(
				game.state.deck.map( domino => domino.id ),
				DOMINO_DECK.map( domino => domino.id )
			);
		} );
	} );

	describe( "selectDomino", () => {

		const drafting = ( draft = [ entry( 5 ), entry( 12 ), entry( 30 ), entry( 44 ) ] ) =>
			at( { draft, selectionOrder: [ alice, bob, carol ] } );

		it( "accepts a domino still on offer", () => {
			assert.isUndefined( drafting().validate( "selectDomino", alice, { dominoId: 12 } ) );
		} );

		it( "refuses a domino that is not in the row", () => {
			const invalid = drafting().validate( "selectDomino", alice, { dominoId: 7 } );
			assert.include( invalid?.reason ?? "", "not in the row on offer" );
		} );

		it( "refuses a domino somebody already claimed", () => {
			const game = drafting( [ entry( 5, bob ), entry( 12 ), entry( 30 ), entry( 44 ) ] );
			const invalid = game.validate( "selectDomino", alice, { dominoId: 5 } );
			assert.include( invalid?.reason ?? "", "already been claimed" );
		} );

		it( "marks the row and puts the domino in the claimant's queue", () => {
			const game = drafting();
			game.play( "selectDomino", alice, { dominoId: 12 } );

			assert.strictEqual( game.state.draft[ 1 ]?.selectedBy, alice );
			assert.deepStrictEqual( [ ...game.state.playerData[ alice ]!.queue ], [ 12 ] );
		} );
	} );

	describe( "placeDomino", () => {

		const holding = ( queue: ReadonlyArray<number> ) => at(
			{ playerData: { [ alice ]: seat( queue ), [ bob ]: seat(), [ carol ]: seat() } },
			"PLACE"
		);

		it( "refuses a seat holding nothing", () => {
			const game = holding( [] );
			const invalid = game.validate( "placeDomino", alice, {
				placement: { dominoId: 1, coord: { x: 1, y: 0 }, rotation: 0 }
			} );

			assert.include( invalid?.reason ?? "", "no domino left to lay" );
		} );

		it( "makes a seat lay its lowest claim first", () => {
			// The kings are placed in id order, so the domino claimed with the
			// earlier king is the one laid first.
			const game = holding( [ 30, 12 ] );
			const invalid = game.validate( "placeDomino", alice, {
				placement: { dominoId: 30, coord: { x: 1, y: 0 }, rotation: 0 }
			} );

			assert.include( invalid?.reason ?? "", "lay domino 12 before any other" );
		} );

		it( "refuses a placement that does not fit", () => {
			const game = holding( [ 1 ] );
			const invalid = game.validate( "placeDomino", alice, {
				placement: { dominoId: 1, coord: { x: 4, y: 4 }, rotation: 0 }
			} );

			assert.include( invalid?.reason ?? "", "does not fit there" );
		} );

		it( "accepts a placement touching the castle", () => {
			const game = holding( [ 1 ] );
			const legal = getValidPlacements( game.state.playerData[ alice ]!.board, 1 )[ 0 ]!;

			assert.isUndefined( game.validate( "placeDomino", alice, { placement: legal } ) );
		} );

		it( "lays the kingdom and scores it in the same event", () => {
			const game = holding( [ 1 ] );
			const legal = getValidPlacements( game.state.playerData[ alice ]!.board, 1 )[ 0 ]!;

			const events = game.execute( "placeDomino", alice, { placement: legal } );
			assert.deepStrictEqual( tags( events ), [ "kingdomino/ev/DominoPlaced" ] );

			game.apply( ...events );
			const player = game.state.playerData[ alice ]!;

			assert.strictEqual( Object.keys( player.board.tiles ).length, 3 );
			assert.deepStrictEqual( [ ...player.queue ], [], "and the queue empties" );
			assert.isDefined( player.score );
		} );

		it( "only ever touches the acting seat's kingdom", () => {
			const game = holding( [ 1 ] );
			const legal = getValidPlacements( game.state.playerData[ alice ]!.board, 1 )[ 0 ]!;
			game.play( "placeDomino", alice, { placement: legal } );

			assert.strictEqual( Object.keys( game.state.playerData[ bob ]!.board.tiles ).length, 1 );
		} );
	} );

	describe( "discardDomino", () => {

		/** A kingdom filled out so nothing more fits. */
		const boxedIn = () => {
			const full: Record<string, { terrain: "water"; crowns: 0 }> = {};
			for ( let x = 0; x < 5; x++ ) {
				for ( let y = 0; y < 5; y++ ) {
					full[ `${ x },${ y }` ] = { terrain: "water", crowns: 0 };
				}
			}

			return at(
				{
					playerData: {
						[ alice ]: {
							board: { size: 5, castle: "red", placements: [], tiles: full },
							queue: [ 1 ],
							score: { regions: [], points: 0 }
						},
						[ bob ]: seat(),
						[ carol ]: seat()
					}
				},
				"PLACE"
			);
		};

		it( "refuses a seat holding nothing", () => {
			const game = at( {}, "PLACE" );
			const invalid = game.validate( "discardDomino", alice, { dominoId: 1 } );
			assert.include( invalid?.reason ?? "", "no domino left to give up" );
		} );

		it( "makes a seat give up its lowest claim first", () => {
			const game = at(
				{ playerData: { [ alice ]: seat( [ 30, 12 ] ), [ bob ]: seat(), [ carol ]: seat() } },
				"PLACE"
			);

			const invalid = game.validate( "discardDomino", alice, { dominoId: 30 } );
			assert.include( invalid?.reason ?? "", "lay domino 12 before any other" );
		} );

		it( "refuses a domino that still fits somewhere", () => {
			// A discard a seat could reach at will would be a free way out of an
			// awkward claim, and the whole cost of claiming greedily would go with it.
			const game = at(
				{ playerData: { [ alice ]: seat( [ 1 ] ), [ bob ]: seat(), [ carol ]: seat() } },
				"PLACE"
			);

			const invalid = game.validate( "discardDomino", alice, { dominoId: 1 } );
			assert.include( invalid?.reason ?? "", "still fits somewhere" );
		} );

		it( "allows it once the kingdom genuinely has no room", () => {
			const game = boxedIn();
			assert.strictEqual(
				getValidPlacements( game.state.playerData[ alice ]!.board, 1 ).length,
				0
			);
			assert.isUndefined( game.validate( "discardDomino", alice, { dominoId: 1 } ) );
		} );

		it( "empties the queue without touching the kingdom", () => {
			const game = boxedIn();
			const before = Object.keys( game.state.playerData[ alice ]!.board.tiles ).length;

			game.play( "discardDomino", alice, { dominoId: 1 } );

			assert.deepStrictEqual( [ ...game.state.playerData[ alice ]!.queue ], [] );
			assert.strictEqual(
				Object.keys( game.state.playerData[ alice ]!.board.tiles ).length,
				before
			);
		} );
	} );

	describe( "the SELECT phase", () => {

		it( "turns the next row face up, lowest id first", () => {
			const game = at( { deck: [ ...DOMINO_DECK ].reverse() } );
			const events = game.phase( "SELECT" ).onEnter();

			assert.deepStrictEqual( tags( events ), [ "kingdomino/ev/DraftDrawn" ] );

			game.apply( ...events );
			assert.strictEqual( game.state.draft.length, KINGDOMINO_DRAFT_SIZE );
			assert.deepStrictEqual(
				game.state.draft.map( item => item.domino.id ),
				game.state.draft.map( item => item.domino.id ).sort( ( a, b ) => a - b )
			);
			assert.strictEqual( game.state.deck.length, KINGDOMINO_DECK_SIZE - KINGDOMINO_DRAFT_SIZE );
		} );

		it( "draws nothing from an empty deck", () => {
			assert.deepStrictEqual( at().phase( "SELECT" ).onEnter(), [] );
		} );

		it( "seats whoever holds the next unclaimed slot", () => {
			const game = at( {
				draft: [ entry( 5, alice ), entry( 12 ), entry( 30 ), entry( 44 ) ],
				selectionOrder: [ alice, bob, carol ]
			} );

			assert.strictEqual( game.phase( "SELECT" ).startingPlayer(), bob );
			assert.strictEqual( game.phase( "SELECT" ).nextPlayer( alice, "selectDomino" ), bob );
		} );

		it( "runs until the row is claimed as far as it will be", () => {
			const three = ( ...claims: ReadonlyArray<PlayerId | undefined> ) => at( {
				draft: [ 5, 12, 30, 44 ].map( ( id, i ) => entry( id, claims[ i ] ) ),
				selectionOrder: [ alice, bob, carol ]
			} );

			assert.isFalse( three().phase( "SELECT" ).endIf() );
			assert.isFalse( three( alice, bob ).phase( "SELECT" ).endIf() );

			// Three seats owe three claims, so the fourth domino is never claimed.
			assert.isTrue( three( alice, bob, carol ).phase( "SELECT" ).endIf() );
		} );

		it( "throws the leftover out of the game as it leaves", () => {
			const game = at( {
				draft: [ entry( 5, alice ), entry( 12, bob ), entry( 30, carol ), entry( 44 ) ],
				selectionOrder: [ alice, bob, carol ]
			} );

			const events = game.phase( "SELECT" ).onExit();
			assert.deepStrictEqual( tags( events ), [
				"kingdomino/ev/DraftPruned",
				"kingdomino/ev/SelectionOrderRecomputed"
			] );

			assert.deepStrictEqual(
				( events[ 0 ] as unknown as { dominoIds: ReadonlyArray<number> } ).dominoIds,
				[ 44 ]
			);
		} );

		it( "prunes nothing when every domino was claimed", () => {
			const game = at( {
				draft: [ entry( 5, alice ), entry( 12, bob ), entry( 30, alice ), entry( 44, bob ) ],
				selectionOrder: [ alice, bob, alice, bob ]
			}, "SELECT", alice, [ alice, bob ] );

			assert.deepStrictEqual(
				tags( game.phase( "SELECT" ).onExit() ),
				[ "kingdomino/ev/SelectionOrderRecomputed" ]
			);
		} );

		it( "reads the next order off the claims, lowest domino first", () => {
			// Claiming a weak, low domino to buy an early pick is the whole decision
			// the game offers, and this is where it is paid out.
			const game = at( {
				draft: [ entry( 5, carol ), entry( 12, alice ), entry( 30, bob ), entry( 44 ) ],
				selectionOrder: [ alice, bob, carol ]
			} );

			const events = game.phase( "SELECT" ).onExit();
			game.apply( ...events );

			assert.deepStrictEqual( [ ...game.state.selectionOrder ], [ carol, alice, bob ] );
		} );

		it( "always hands over to PLACE", () => {
			assert.strictEqual( at().phase( "SELECT" ).nextPhase(), "PLACE" );
		} );
	} );

	describe( "the PLACE phase", () => {

		const holding = (
			queues: Record<string, ReadonlyArray<number>>,
			order: ReadonlyArray<PlayerId>
		) => at(
			{
				playerData: Object.fromEntries(
					[ alice, bob, carol ].map( id => [ id, seat( queues[ id ] ?? [] ) ] )
				),
				selectionOrder: order
			},
			"PLACE"
		);

		it( "seats the first slot of the round's order", () => {
			const game = holding( { alice: [ 5 ], bob: [ 12 ], carol: [ 30 ] }, [ carol, alice, bob ] );
			assert.strictEqual( game.phase( "PLACE" ).startingPlayer(), carol );
		} );

		it( "walks the same order the table claimed in", () => {
			// The number still held says how many slots are left, and the difference
			// says which slot is next.
			const game = holding( { alice: [ 5 ], bob: [ 12 ] }, [ carol, alice, bob ] );
			assert.strictEqual( game.phase( "PLACE" ).nextPlayer( carol, "placeDomino" ), alice );
		} );

		it( "counts a discard as a placement", () => {
			const game = holding( { bob: [ 12 ] }, [ carol, alice, bob ] );
			assert.strictEqual( game.phase( "PLACE" ).nextPlayer( alice, "discardDomino" ), bob );
		} );

		it( "runs until nobody is holding anything", () => {
			assert.isFalse(
				holding( { alice: [ 5 ] }, [ alice, bob, carol ] ).phase( "PLACE" ).endIf()
			);
			assert.isTrue( holding( {}, [ alice, bob, carol ] ).phase( "PLACE" ).endIf() );
		} );

		it( "always points back at SELECT — `endIf` is what stops the loop", () => {
			assert.strictEqual( holding( {}, [] ).phase( "PLACE" ).nextPhase(), "SELECT" );
		} );
	} );

	describe( "endIf", () => {

		it( "keeps going while the deck still holds a row", () => {
			const game = at( { deck: DOMINO_DECK.slice( 0, 4 ) } );
			assert.isFalse( game.endIf() );
		} );

		it( "keeps going while anybody is still holding a domino", () => {
			const game = at( {
				playerData: { [ alice ]: seat( [ 5 ] ), [ bob ]: seat(), [ carol ]: seat() }
			} );

			assert.isFalse( game.endIf() );
		} );

		it( "ends with an empty deck and an empty table", () => {
			assert.isTrue( at().endIf() );
		} );

		it( "does not call an empty table finished", () => {
			// A table with no players has not finished, it has not begun.
			assert.isFalse( at( {}, "SELECT", alice, [] ).endIf() );
		} );
	} );

	describe( "the view", () => {

		it( "publishes every kingdom — a kingdom is built face up", () => {
			const game = at( {
				playerData: { [ alice ]: seat( [ 5 ] ), [ bob ]: seat(), [ carol ]: seat() }
			} );

			const view = game.view( TableAudience.make( {} ) );
			assert.strictEqual( Object.keys( view.playerData ).length, 3 );
			assert.deepStrictEqual( [ ...view.playerData[ alice ]!.queue ], [ 5 ] );
		} );

		it( "publishes the row and who claimed what", () => {
			const game = at( { draft: [ entry( 5, alice ), entry( 12 ) ] } );
			const view = game.view( TableAudience.make( {} ) );

			assert.strictEqual( view.draft[ 0 ]?.selectedBy, alice );
			assert.isUndefined( view.draft[ 1 ]?.selectedBy );
		} );

		it( "reduces the deck to a count, and never its order", () => {
			// Which dominoes are still to come is the game's whole hidden information.
			const game = at( { deck: DOMINO_DECK.slice( 0, 12 ) } );
			const view = game.view( TableAudience.make( {} ) );

			assert.strictEqual( view.deckCount, 12 );
			assert.notProperty( view, "deck" );
		} );

		it( "differs between audiences only by playerId", () => {
			const game = at( { draft: [ entry( 5 ) ], deck: DOMINO_DECK.slice( 0, 4 ) } );
			const table = game.view( TableAudience.make( {} ) );
			const mine = game.view( PlayerAudience.make( { playerId: bob } ) );

			assert.isUndefined( table.playerId );
			assert.strictEqual( mine.playerId, bob );
			assert.deepStrictEqual( { ...table, playerId: bob }, { ...mine } );
		} );
	} );

	describe( "resolveResults", () => {

		const scored = ( points: number, tiles: number, crowns: number ) => ( {
			board: createBoard( "red", 5 ),
			queue: [],
			score: {
				points,
				regions: [ { id: "r", terrain: "forest" as const, tiles, placement: [], crowns, points } ]
			}
		} );

		it( "ranks on points, then largest property, then crowns", () => {
			const game = at( {
				playerData: {
					[ alice ]: scored( 20, 4, 3 ),
					[ bob ]: scored( 20, 6, 1 ),
					[ carol ]: scored( 25, 2, 2 )
				}
			} );

			const results = game.results();
			assert.strictEqual( results?.winner, carol );
			assert.deepStrictEqual(
				results?.ranking.map( entry => [ entry.playerId, entry.rank ] ),
				[ [ carol, 1 ], [ bob, 2 ], [ alice, 3 ] ]
			);
		} );

		it( "lets seats level on all three share a rank with no winner", () => {
			const level = scored( 20, 4, 3 );
			const game = at( {
				playerData: { [ alice ]: level, [ bob ]: level, [ carol ]: level }
			} );

			const results = game.results();
			assert.isUndefined( results?.winner );
			assert.deepStrictEqual( results?.ranking.map( entry => entry.rank ), [ 1, 1, 1 ] );
		} );
	} );

	describe( "botMove", () => {

		it( "claims a domino that is actually on offer", () => {
			const game = at( {
				draft: [ entry( 5 ), entry( 12, bob ), entry( 30 ), entry( 44 ) ],
				selectionOrder: [ alice, bob, carol ]
			} );

			const choice = game.bot( PlayerAudience.make( { playerId: alice } ) );
			assert.strictEqual( choice?.moveType, "selectDomino" );
			assert.isUndefined( game.validate( "selectDomino", alice, choice!.input as never ) );
		} );

		it( "plays only a placement the rules would accept", () => {
			const game = at(
				{ playerData: { [ alice ]: seat( [ 1 ] ), [ bob ]: seat(), [ carol ]: seat() } },
				"PLACE"
			);

			const choice = game.bot( PlayerAudience.make( { playerId: alice } ) );
			assert.strictEqual( choice?.moveType, "placeDomino" );
			assert.isUndefined( game.validate( "placeDomino", alice, choice!.input as never ) );
		} );
	} );
} );
