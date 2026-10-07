import { assert, describe, it } from "@effect/vitest";

import type { Ask, Claim, FishState } from "@/games/fish/schema";
import {
	asksOf,
	bookOfClaim,
	buildConfig,
	canTransferTurn,
	claimsOf,
	FISH_TEAMS,
	getBookForCard,
	getBooksInHand,
	getBookWinner,
	getCardsOfBook,
	getClaimedBooks,
	getLiveBooks,
	getMetrics,
	getMissingCards,
	getTeamScores,
	holderOf,
	isBookInHand,
	isGameComplete,
	lastAsk,
	lastClaim,
	lastTransfer,
	nextHolder,
	teamCountsFor
} from "@/games/fish/utils";
import type { CardId } from "@/shared/utils/cards";
import type { GameContext, PlayerId, TeamId } from "@/swish/schema";
import { GameContext as Context } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;
const dave = "dave" as PlayerId;

const ONE = "TEAM_1" as TeamId;
const TWO = "TEAM_2" as TeamId;

/** Seats interleaved, as `start` seats a team game. */
const context = ( overrides: Partial<GameContext> = {} ): GameContext => Context.make( {
	turn: 0,
	players: [ alice, bob, carol, dave ],
	teams: { [ alice ]: ONE, [ bob ]: TWO, [ carol ]: ONE, [ dave ]: TWO },
	teamNames: {},
	interactions: [],
	interactionCount: 0,
	...overrides
} );

const ask = ( overrides: Partial<Ask> = {} ): Ask => ( {
	_tag: "fish/Ask",
	success: true,
	playerId: alice,
	from: bob,
	cardId: "2H",
	...overrides
} );

const claim = ( overrides: Partial<Claim> = {} ): Claim => ( {
	_tag: "fish/Claim",
	success: true,
	playerId: alice,
	book: "TWOS",
	correctClaim: {},
	actualClaim: {},
	...overrides
} );

const known = ( moves: ReadonlyArray<Ask | Claim>, counts: Record<string, number> = {} ) => ( {
	cardCounts: counts as Record<PlayerId, number>,
	moves
} );


describe( "fish utils", () => {

	describe( "books", () => {

		it( "files a card under its rank in the NORMAL variant", () => {
			assert.strictEqual( getBookForCard( "2H", "NORMAL" ), "TWOS" );
			assert.strictEqual( getBookForCard( "AH", "NORMAL" ), "ACES" );
		} );

		it( "has no CANADIAN book for a seven", () => {
			// The CANADIAN deck has none, and a caller taking a card from client
			// input has to handle that rather than assert its way past it.
			assert.isUndefined( getBookForCard( "7H", "CANADIAN" ) );
			assert.strictEqual( getBookForCard( "7H", "NORMAL" ), "SEVENS" );
		} );

		it( "splits a suit into a lower and an upper book in the CANADIAN variant", () => {
			assert.strictEqual( getBookForCard( "AH", "CANADIAN" ), "LH" );
			assert.strictEqual( getBookForCard( "6H", "CANADIAN" ), "LH" );
			assert.strictEqual( getBookForCard( "8H", "CANADIAN" ), "UH" );
			assert.strictEqual( getBookForCard( "KH", "CANADIAN" ), "UH" );
		} );

		it( "gives a NORMAL book four cards and a CANADIAN one six", () => {
			assert.strictEqual( getCardsOfBook( "TWOS" ).length, 4 );
			assert.strictEqual( getCardsOfBook( "LH" ).length, 6 );
		} );

		it( "lists the books a hand holds a card of", () => {
			const hand: ReadonlyArray<CardId> = [ "2H", "2S", "AH" ];
			assert.deepStrictEqual( getBooksInHand( hand, "NORMAL" ).sort(), [ "ACES", "TWOS" ] );
		} );

		it( "answers whether one book is in hand", () => {
			assert.isTrue( isBookInHand( [ "2H" ], "TWOS", "NORMAL" ) );
			assert.isFalse( isBookInHand( [ "2H" ], "ACES", "NORMAL" ) );
		} );

		it( "names the cards of a book a hand is missing", () => {
			const missing = getMissingCards( [ "2H" ], "TWOS", "NORMAL" );
			assert.strictEqual( missing.length, 3 );
			assert.notInclude( missing, "2H" );
		} );
	} );

	describe( "the history", () => {

		it( "separates asks from declarations", () => {
			const table = known( [ ask(), claim(), ask( { success: false } ) ] );

			assert.strictEqual( asksOf( table ).length, 2 );
			assert.strictEqual( claimsOf( table ).length, 1 );
		} );

		it( "reads only the tail, so a gate cannot be banked and spent later", () => {
			// Each of these answers about the move that *just* happened, never about
			// one buried in the history.
			const after = ( ...moves: ReadonlyArray<Ask | Claim> ) =>
				( { hands: {}, cardCounts: {}, moves } ) as FishState;

			assert.strictEqual( lastAsk( after( claim(), ask( { cardId: "3H" } ) ) )?.cardId, "3H" );
			assert.isUndefined( lastAsk( after( ask(), claim() ) ) );

			assert.strictEqual( lastClaim( after( ask(), claim() ) )?.book, "TWOS" );
			assert.isUndefined( lastClaim( after( claim(), ask() ) ) );

			assert.isUndefined( lastTransfer( after( claim() ) ) );
		} );

		it( "takes a declared book out of play, won or lost", () => {
			const table = known( [
				claim( { book: "TWOS" } ),
				claim( { book: "ACES", success: false } )
			] );

			assert.deepStrictEqual( getClaimedBooks( table ), [ "TWOS", "ACES" ] );
			assert.deepStrictEqual(
				getLiveBooks( table, [ "TWOS", "ACES", "KINGS" ] ),
				[ "KINGS" ]
			);
		} );

		it( "calls the table played out once every book is declared", () => {
			assert.isFalse( isGameComplete( known( [] ), [ "TWOS" ] ) );
			assert.isTrue( isGameComplete( known( [ claim( { book: "TWOS" } ) ] ), [ "TWOS" ] ) );
		} );
	} );

	describe( "canTransferTurn", () => {

		it( "is true directly after your own correct declaration", () => {
			assert.isTrue( canTransferTurn( known( [ claim() ] ), alice ) );
		} );

		it( "is false after a wrong one", () => {
			assert.isFalse( canTransferTurn( known( [ claim( { success: false } ) ] ), alice ) );
		} );

		it( "is false after somebody else's", () => {
			assert.isFalse( canTransferTurn( known( [ claim( { playerId: bob } ) ] ), alice ) );
		} );

		it( "expires the moment anything else happens", () => {
			// The declaration stays in the history all game, so asking whether it is
			// in there at all would let a seat bank the right and spend it later.
			assert.isFalse( canTransferTurn( known( [ claim(), ask() ] ), alice ) );
		} );

		it( "is false with nothing in the history", () => {
			assert.isFalse( canTransferTurn( known( [] ), alice ) );
		} );
	} );

	describe( "getBookWinner", () => {

		it( "gives a correct declaration to the declarer's side", () => {
			assert.strictEqual( getBookWinner( claim(), context() ), ONE );
		} );

		it( "gives a wrong one to the opposing side holding most of it", () => {
			const wrong = claim( {
				success: false,
				correctClaim: { "2H": bob, "2S": bob, "2C": dave, "2D": alice }
			} );

			assert.strictEqual( getBookWinner( wrong, context() ), TWO );
		} );

		it( "hands a book entirely inside the declaring side to the first opposing one", () => {
			const wrong = claim( {
				success: false,
				correctClaim: { "2H": alice, "2S": carol, "2C": alice, "2D": carol }
			} );

			assert.strictEqual( getBookWinner( wrong, context() ), TWO );
		} );

		it( "has no winner at a table without sides", () => {
			assert.isUndefined( getBookWinner( claim(), context( { teams: {} } ) ) );
		} );
	} );

	describe( "getTeamScores", () => {

		it( "counts a book to every side, zero included", () => {
			const scores = getTeamScores( [ claim( { book: "TWOS" } ) ], context(), [ ONE, TWO ] );
			assert.deepStrictEqual( { ...scores }, { TEAM_1: 1, TEAM_2: 0 } );
		} );

		it( "credits a wrong declaration to the opposition", () => {
			const scores = getTeamScores(
				[
					claim( { book: "TWOS" } ),
					claim( {
						book: "ACES",
						success: false,
						correctClaim: { AH: bob, AS: bob, AC: dave, AD: dave }
					} )
				],
				context(),
				[ ONE, TWO ]
			);

			assert.deepStrictEqual( { ...scores }, { TEAM_1: 1, TEAM_2: 1 } );
		} );
	} );

	describe( "getMetrics", () => {

		it( "counts asks, hits and cards given up", () => {
			const table = known( [
				ask( { playerId: alice, from: bob, success: true } ),
				ask( { playerId: alice, from: bob, success: false } ),
				ask( { playerId: bob, from: alice, success: true } )
			] );

			const metrics = getMetrics( table, [ alice, bob ] );

			assert.strictEqual( metrics[ alice ]?.totalAsks, 2 );
			assert.strictEqual( metrics[ alice ]?.cardsTaken, 1 );
			assert.strictEqual( metrics[ alice ]?.cardsGiven, 1 );
			assert.strictEqual( metrics[ bob ]?.cardsGiven, 1 );
		} );

		it( "counts declarations and how many came off", () => {
			const table = known( [
				claim( { playerId: alice, success: true } ),
				claim( { playerId: alice, success: false, book: "ACES" } )
			] );

			const metrics = getMetrics( table, [ alice ] );
			assert.strictEqual( metrics[ alice ]?.totalClaims, 2 );
			assert.strictEqual( metrics[ alice ]?.successfulClaims, 1 );
		} );

		it( "gives a seat that never acted a row of zeroes", () => {
			const metrics = getMetrics( known( [] ), [ alice ] );
			assert.deepStrictEqual( metrics[ alice ], {
				totalAsks: 0,
				cardsTaken: 0,
				cardsGiven: 0,
				totalClaims: 0,
				successfulClaims: 0
			} );
		} );
	} );

	describe( "holderOf and nextHolder", () => {

		const hands = {
			[ alice ]: [ "2H" ] as ReadonlyArray<CardId>,
			[ bob ]: [ "3H" ] as ReadonlyArray<CardId>
		};

		it( "finds who is holding a card", () => {
			assert.strictEqual( holderOf( hands, "3H" ), bob );
			assert.isUndefined( holderOf( hands, "AS" ) );
		} );

		it( "walks round the table to the next seat still holding cards", () => {
			const counts = { [ alice ]: 1, [ bob ]: 0, [ carol ]: 2, [ dave ]: 0 };
			assert.strictEqual( nextHolder( context(), counts, alice ), carol );
		} );

		it( "honours a filter, so a wrong declaration can go to the opposition", () => {
			const counts = { [ alice ]: 1, [ bob ]: 1, [ carol ]: 1, [ dave ]: 1 };
			const next = nextHolder(
				context(),
				counts,
				alice,
				candidate => context().teams[ candidate ] !== ONE
			);

			assert.strictEqual( next, bob );
		} );

		it( "finds nobody at a table where nobody holds anything", () => {
			const counts = { [ alice ]: 0, [ bob ]: 0, [ carol ]: 0, [ dave ]: 0 };
			assert.isUndefined( nextHolder( context(), counts, alice ) );
		} );
	} );

	describe( "bookOfClaim", () => {

		it( "names the one book a declaration covers", () => {
			const cards = getCardsOfBook( "TWOS" );
			const spread = Object.fromEntries( cards.map( card => [ card, alice ] ) );

			assert.strictEqual( bookOfClaim( spread, "NORMAL" ), "TWOS" );
		} );

		it( "refuses a declaration spanning two books", () => {
			assert.isUndefined( bookOfClaim( { "2H": alice, AH: alice }, "NORMAL" ) );
		} );

		it( "refuses a declaration missing a card of its book", () => {
			assert.isUndefined( bookOfClaim( { "2H": alice }, "NORMAL" ) );
		} );
	} );

	describe( "the table shape", () => {

		it( "offers only side counts that divide the seats evenly", () => {
			assert.deepStrictEqual( [ ...teamCountsFor( 4 ) ], [ 2, 4 ] );
			assert.deepStrictEqual( [ ...teamCountsFor( 6 ) ], [ 2, 3 ] );
			assert.deepStrictEqual( [ ...teamCountsFor( 8 ) ], [ 2, 4 ] );
		} );

		it( "drops the sevens when the full deck will not divide evenly", () => {
			// Six seats cannot share 52 cards, so a NORMAL table of six plays 48.
			const six = buildConfig( 6, "NORMAL", 2 );

			assert.strictEqual( six.deckType, 48 );
			assert.strictEqual( six.bookSize, 4 );
			assert.strictEqual( six.books.length, 12 );
			assert.notInclude( [ ...six.books ], "SEVENS" );
			assert.deepStrictEqual( [ ...six.teams ], FISH_TEAMS.slice( 0, 2 ) );
		} );

		it( "keeps them when it will", () => {
			const four = buildConfig( 4, "NORMAL", 2 );

			assert.strictEqual( four.deckType, 52 );
			assert.strictEqual( four.books.length, 13 );
			assert.include( [ ...four.books ], "SEVENS" );
		} );

		it( "builds a CANADIAN table out of eight six-card books", () => {
			const config = buildConfig( 4, "CANADIAN", 2 );

			assert.strictEqual( config.deckType, 48 );
			assert.strictEqual( config.bookSize, 6 );
			assert.strictEqual( config.books.length, 8 );
		} );

		it( "names as many sides as it was asked for", () => {
			assert.strictEqual( buildConfig( 8, "NORMAL", 4 ).teams.length, 4 );
		} );

		it( "deals a deck that divides evenly among the seats", () => {
			for ( const seats of [ 4, 6, 8 ] as const ) {
				const config = buildConfig( seats, "NORMAL", 2 );
				assert.strictEqual(
					config.books.length * config.bookSize % seats,
					0,
					`${ seats } seats`
				);
			}
		} );
	} );
} );
