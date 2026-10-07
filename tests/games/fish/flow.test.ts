import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import type { Table } from "@tests/harness/table";
import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { makeUsers } from "@tests/harness/users";

import { FishEngine, FishEngineLive, FishStructure } from "@/games/fish/server/engine";
import { fishConfigFor, getBookForCard, getCardsOfBook } from "@/games/fish/utils";
import type { CardId } from "@/shared/utils/cards";
import type { PlayerId, TeamId } from "@/swish/schema";


const Fish = { Engine: FishEngine, EngineLive: FishEngineLive, Structure: FishStructure };

const alice = "alice" as PlayerId;

const ONE = "TEAM_1" as TeamId;
const TWO = "TEAM_2" as TeamId;

const TABLE = Object.values( makeUsers( [ "alice", "bob", "carol", "dave" ] as const ) );

type FishTable = Table<typeof FishStructure>;

const FOUR_HANDED = { ...fishConfigFor( 4, "NORMAL", 2 ), ...PARKED };

/** A seated table, not yet started — fish does not start itself. */
const seated = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Fish, {
		players: TABLE,
		name,
		config: { ...FOUR_HANDED, ...config }
	} );

	yield* game.joinAll();
	return game;
} );

/** A started table, sides balanced and hands dealt. */
const dealt = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* seated( name, config );
	yield* game.start();
	return game;
} );

/** Every seat's hand, read back off its own view. */
const handsOf = ( game: FishTable ) => Effect.gen( function* () {
	const hands: Record<PlayerId, ReadonlyArray<CardId>> = {};
	for ( const seat of game.roster ) {
		hands[ seat.id ] = ( yield* game.state( seat ) ).hand;
	}

	return hands;
} );

/** An ask the rules will accept, for whoever the cursor is on. */
const legalAsk = ( game: FishTable ) => Effect.gen( function* () {
	const view = yield* game.view();
	const seat = view.context.currentPlayer!;
	const hands = yield* handsOf( game );
	const mine = hands[ seat ]!;

	for ( const card of mine ) {
		const book = getBookForCard( card, view.config.type );
		if ( !book ) {
			continue;
		}

		for ( const other of view.context.players ) {
			if ( view.context.teams[ other ] === view.context.teams[ seat ] ) {
				continue;
			}

			if ( ( view.view.cardCounts[ other ] ?? 0 ) === 0 ) {
				continue;
			}

			const target = getCardsOfBook( book ).find( item => !mine.includes( item ) );
			if ( target ) {
				return { seat, from: other, cardId: target, hit: hands[ other ]!.includes( target ) };
			}
		}
	}

	return undefined;
} );


describe( "fish flow", () => {

	describe( "the lobby", () => {

		it.live( "does not start itself, even once the table is full", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-manual" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "PLAYERS_READY" );
			assert.deepStrictEqual( view.context.teams, {} );
		} ) );

		it.live( "refuses starting a table that is not full", () => Effect.gen( function* () {
			const game = yield* makeTable( Fish, {
				players: TABLE,
				name: "lobby-partial",
				config: FOUR_HANDED
			} );

			yield* game.join( "bob" );

			const tag = yield* rejectionTag( game.start() );
			assert.strictEqual( tag, "swish/CannotStart" );
		} ) );

		it.live( "lets a player pick a side", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-join-team" );
			yield* game.joinTeam( "alice", ONE );

			const view = yield* game.view();
			assert.strictEqual( view.context.teams[ alice ], ONE );
		} ) );

		it.live( "refuses a side the table does not have", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-bad-team" );
			const tag = yield* rejectionTag( game.joinTeam( "alice", "TEAM_9" ) );
			assert.strictEqual( tag, "swish/TeamNotFound" );
		} ) );

		it.live( "refuses a side that is already full", () => Effect.gen( function* () {
			// Sides are equal-sized: four seats over two sides is two each.
			const game = yield* seated( "lobby-full-team" );

			yield* game.joinTeam( "alice", ONE );
			yield* game.joinTeam( "bob", ONE );

			const tag = yield* rejectionTag( game.joinTeam( "carol", ONE ) );
			assert.strictEqual( tag, "swish/TeamFull" );
		} ) );

		it.live( "treats re-joining your own side as a no-op", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-rejoin" );
			yield* game.joinTeam( "alice", ONE );

			const before = yield* game.view();
			yield* game.joinTeam( "alice", ONE );
			const after = yield* game.view();

			assert.strictEqual( after.version, before.version );
			assert.strictEqual( after.context.teams[ alice ], ONE );
		} ) );

		it.live( "lets a player leave a side", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-leave" );
			yield* game.joinTeam( "alice", ONE );
			yield* game.leaveTeam( "alice" );

			assert.isUndefined( ( yield* game.view() ).context.teams[ alice ] );
		} ) );

		it.live( "treats leaving no side as a silent no-op", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-leave-none" );
			const before = yield* game.view();

			yield* game.leaveTeam( "alice" );

			const after = yield* game.view();
			assert.strictEqual( after.version, before.version );
			assert.deepStrictEqual( after.context.teams, {} );
		} ) );

		it.live( "names a side, once", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-name" );
			yield* game.joinTeam( "alice", ONE );
			yield* game.nameTeam( "alice", ONE, "The Sharks" );

			assert.strictEqual( ( yield* game.view() ).context.teamNames[ ONE ], "The Sharks" );

			const tag = yield* rejectionTag( game.nameTeam( "alice", ONE, "The Minnows" ) );
			assert.strictEqual( tag, "swish/TeamAlreadyNamed" );
		} ) );

		it.live( "refuses naming a side you are not on", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-name-other" );
			yield* game.joinTeam( "alice", ONE );

			const tag = yield* rejectionTag( game.nameTeam( "bob", ONE, "Theirs" ) );
			assert.strictEqual( tag, "swish/NotOnTeam" );
		} ) );
	} );

	describe( "starting", () => {

		it.live(
			"balances whoever picked nothing and interleaves the seats",
			() => Effect.gen( function* () {
				const game = yield* dealt( "start-balance" );
				const view = yield* game.view();

				assert.strictEqual( view.status, "IN_PROGRESS" );

				const sides = view.context.players.map( seat => view.context.teams[ seat ] );
				assert.strictEqual( sides.filter( side => side === ONE ).length, 2 );
				assert.strictEqual( sides.filter( side => side === TWO ).length, 2 );

				// Interleaved, so the default round-robin already alternates sides.
				assert.notStrictEqual( sides[ 0 ], sides[ 1 ] );
				assert.notStrictEqual( sides[ 1 ], sides[ 2 ] );
				assert.notStrictEqual( sides[ 2 ], sides[ 3 ] );
			} )
		);

		it.live( "honours a side somebody picked", () => Effect.gen( function* () {
			const game = yield* seated( "start-honours" );
			yield* game.joinTeam( "alice", TWO );
			yield* game.start();

			assert.strictEqual( ( yield* game.view() ).context.teams[ alice ], TWO );
		} ) );

		it.live( "deals the whole deck out evenly", () => Effect.gen( function* () {
			const game = yield* dealt( "start-deal" );
			const view = yield* game.view();

			// Four seats share the full 52 cards — the sevens stay in.
			assert.deepStrictEqual( Object.values( view.view.cardCounts ), [ 13, 13, 13, 13 ] );
			assert.strictEqual( ( yield* game.state( "alice" ) ).hand.length, 13 );
		} ) );

		it.live( "deals every card exactly once", () => Effect.gen( function* () {
			const game = yield* dealt( "start-distinct" );
			const hands = yield* handsOf( game );
			const all = Object.values( hands ).flat();

			assert.strictEqual( all.length, 52 );
			assert.strictEqual( new Set( all ).size, 52 );
		} ) );

		it.live( "keeps every hand to its own seat", () => Effect.gen( function* () {
			const game = yield* dealt( "start-redaction" );

			assert.strictEqual( ( yield* game.state() ).hand.length, 0 );
			assert.strictEqual( ( yield* game.state( "bob" ) ).hand.length, 13 );

			// The counts are public, and the same for everybody.
			assert.deepStrictEqual(
				( yield* game.state() ).cardCounts,
				( yield* game.state( "alice" ) ).cardCounts
			);
		} ) );
	} );

	describe( "asking", () => {

		it.live( "moves the card and keeps the seat on a hit", () => Effect.gen( function* () {
			const game = yield* dealt( "ask-hit" );

			let played = false;
			for ( let turn = 0; turn < 12 && !played; turn++ ) {
				const ask = yield* legalAsk( game );
				if ( !ask ) {
					break;
				}

				const before = yield* game.view();
				yield* game.move( ask.seat, "askCard", { from: ask.from, cardId: ask.cardId } );
				const after = yield* game.view();

				if ( ask.hit ) {
					assert.strictEqual( after.context.currentPlayer, ask.seat, "the seat keeps the turn" );
					assert.strictEqual(
						after.view.cardCounts[ ask.seat ],
						before.view.cardCounts[ ask.seat ]! + 1
					);
					assert.include( [ ...( yield* game.state( ask.seat ) ).hand ], ask.cardId );
					played = true;
				} else {
					assert.strictEqual( after.context.currentPlayer, ask.from, "the turn goes to them" );
					assert.strictEqual(
						after.view.cardCounts[ ask.seat ],
						before.view.cardCounts[ ask.seat ],
						"and nothing moves"
					);
				}
			}

			assert.isTrue( played, "a landed ask happened" );
		} ) );

		it.live( "records every ask in a history everyone can read", () => Effect.gen( function* () {
			const game = yield* dealt( "ask-history" );
			const ask = ( yield* legalAsk( game ) )!;

			yield* game.move( ask.seat, "askCard", { from: ask.from, cardId: ask.cardId } );

			const table = yield* game.state();
			assert.strictEqual( table.moves.length, 1 );
			assert.strictEqual( table.moves[ 0 ]?._tag, "fish/Ask" );
		} ) );

		it.live( "refuses asking a teammate", () => Effect.gen( function* () {
			const game = yield* dealt( "ask-teammate" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const mate = view.context.players.find(
				other => other !== seat && view.context.teams[ other ] === view.context.teams[ seat ]
			)!;

			const mine = ( yield* game.state( seat ) ).hand;
			const book = getBookForCard( mine[ 0 ]!, view.config.type )!;
			const target = getCardsOfBook( book ).find( card => !mine.includes( card ) )!;

			const tag = yield* rejectionTag(
				game.move( seat, "askCard", { from: mate, cardId: target } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses asking in a book you hold no card of", () => Effect.gen( function* () {
			const game = yield* dealt( "ask-no-book" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const mine = ( yield* game.state( seat ) ).hand;

			const held = new Set( mine.map( card => getBookForCard( card, view.config.type ) ) );
			const foreign = view.config.books.find( book => !held.has( book ) )!;

			const opponent = view.context.players.find(
				other => view.context.teams[ other ] !== view.context.teams[ seat ]
			)!;

			const tag = yield* rejectionTag( game.move( seat, "askCard", {
				from: opponent,
				cardId: getCardsOfBook( foreign )[ 0 ]!
			} ) );

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses an ask out of turn", () => Effect.gen( function* () {
			const game = yield* dealt( "ask-order" );
			const view = yield* game.view();
			const waiting = view.context.players.find( id => id !== view.context.currentPlayer )!;
			const mine = ( yield* game.state( waiting ) ).hand;
			const book = getBookForCard( mine[ 0 ]!, view.config.type )!;
			const target = getCardsOfBook( book ).find( card => !mine.includes( card ) )!;

			const opponent = view.context.players.find(
				other => view.context.teams[ other ] !== view.context.teams[ waiting ]
			)!;

			const tag = yield* rejectionTag(
				game.move( waiting, "askCard", { from: opponent, cardId: target } )
			);

			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );
	} );

	describe( "declaring", () => {

		it.live( "takes the book out of every hand and keeps the turn", () => Effect.gen( function* () {
			const game = yield* dealt( "claim-correct" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const hands = yield* handsOf( game );

			const side = view.context.players.filter(
				other => view.context.teams[ other ] === view.context.teams[ seat ]
			);

			// A book the acting side happens to hold outright, if the deal gave it one.
			const book = view.config.books.find( candidate => {
				const cards = getCardsOfBook( candidate );
				const holders = cards.map( card =>
					side.find( member => hands[ member ]!.includes( card ) ) );

				return holders.every( holder => holder !== undefined )
					&& cards.some( card => hands[ seat ]!.includes( card ) );
			} );

			if ( !book ) {
				return;
			}

			const claim = Object.fromEntries(
				getCardsOfBook( book ).map( card => [
					card,
					side.find( member => hands[ member ]!.includes( card ) )!
				] )
			);

			yield* game.move( seat, "claimBook", { claim } );

			const after = yield* game.view();
			assert.strictEqual( after.context.currentPlayer, seat, "the declarer stays on" );
			assert.strictEqual( after.status, "IN_PROGRESS" );

			const last = after.view.moves.at( -1 );
			assert.strictEqual( last?._tag, "fish/Claim" );

			for ( const player of game.roster ) {
				const hand = ( yield* game.state( player ) ).hand;
				for ( const card of getCardsOfBook( book ) ) {
					assert.notInclude( [ ...hand ], card );
				}
			}
		} ) );

		it.live( "refuses naming an opponent as a holder", () => Effect.gen( function* () {
			const game = yield* dealt( "claim-opponent" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const hands = yield* handsOf( game );

			const mine = hands[ seat ]!;
			const book = getBookForCard( mine[ 0 ]!, view.config.type )!;
			const opponent = view.context.players.find(
				other => view.context.teams[ other ] !== view.context.teams[ seat ]
			)!;

			const claim = Object.fromEntries(
				getCardsOfBook( book ).map( ( card, i ) => [ card, i === 0 ? seat : opponent ] )
			);

			const tag = yield* rejectionTag( game.move( seat, "claimBook", { claim } ) );
			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses a declaration that is not exactly one book", () => Effect.gen( function* () {
			const game = yield* dealt( "claim-mixed" );
			const seat = ( yield* game.view() ).context.currentPlayer!;
			const mine = ( yield* game.state( seat ) ).hand;

			const tag = yield* rejectionTag( game.move( seat, "claimBook", {
				claim: { [ mine[ 0 ]! ]: seat }
			} ) );

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live(
			"refuses transferring without a fresh correct declaration",
			() => Effect.gen( function* () {
				const game = yield* dealt( "transfer-cold" );
				const view = yield* game.view();
				const seat = view.context.currentPlayer!;
				const mate = view.context.players.find(
					other => other !== seat && view.context.teams[ other ] === view.context.teams[ seat ]
				)!;

				const tag = yield* rejectionTag(
					game.move( seat, "transferTurn", { transferTo: mate } )
				);

				assert.strictEqual( tag, "swish/InvalidMove" );
			} )
		);
	} );

	describe( "bots", () => {

		it.live( "plays a whole table out and ranks the sides", () => Effect.gen( function* () {
			const game = yield* makeTable( Fish, {
				players: TABLE,
				name: "bot-table",
				config: {
					...fishConfigFor( 4, "NORMAL", 2 ),
					botDelayMillis: 1,
					moveTimeoutMillis: 20
				}
			} );

			yield* game.joinAll();
			yield* game.start();

			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 120 )
			);

			// Every book declared, so every hand is empty.
			assert.deepStrictEqual( Object.values( view.view.cardCounts ), [ 0, 0, 0, 0 ] );
			assert.isDefined( view.view.metrics );

			// The sides are ranked, and the books add up to the whole deck.
			assert.strictEqual( view.results?.teamRanking?.length, 2 );
			assert.strictEqual(
				view.results!.teamRanking!.reduce( ( total, side ) => total + ( side.score ?? 0 ), 0 ),
				view.config.books.length
			);

			assert.isDefined( view.results?.winningTeam );

			// Everybody on the winning side placed first.
			const winners = view.results!.ranking.filter(
				entry => entry.team === view.results!.winningTeam
			);

			assert.strictEqual( winners.length, 2 );
			for ( const entry of winners ) {
				assert.strictEqual( entry.rank, 1 );
			}
		} ), 180_000 );
	} );
} );
