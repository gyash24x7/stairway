import { assert, describe, it } from "@effect/vitest";

import { atPosition } from "@tests/harness/position";

import type { FishConfig, FishState } from "@/games/fish/schema";
import { FishStructure } from "@/games/fish/server/engine";
import { fishConfigFor, getCardsOfBook } from "@/games/fish/utils";
import type { CardId } from "@/shared/utils/cards";
import type { GameContext, PlayerId, TeamId } from "@/swish/schema";
import { PlayerAudience, TableAudience } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;
const dave = "dave" as PlayerId;

const ONE = "TEAM_1" as TeamId;
const TWO = "TEAM_2" as TeamId;

const SEATS = [ alice, bob, carol, dave ];

/** Seats interleaved, as `start` seats a team game. */
const teams = { [ alice ]: ONE, [ bob ]: TWO, [ carol ]: ONE, [ dave ]: TWO };

const config = ( overrides: Partial<FishConfig> = {} ): FishConfig => ( {
	...fishConfigFor( 4, "NORMAL", 2 ),
	...overrides
} );

const countsFor = ( hands: Record<string, ReadonlyArray<CardId>> ) =>
	Object.fromEntries(
		SEATS.map( seat => [ seat, hands[ seat ]?.length ?? 0 ] )
	) as Record<PlayerId, number>;

const at = (
	hands: Record<string, ReadonlyArray<CardId>>,
	moves: FishState[ "moves" ] = [],
	current: PlayerId = alice,
	contextOverrides: Partial<GameContext> = {},
	configOverrides: Partial<FishConfig> = {}
) => atPosition( FishStructure, {
	state: {
		hands: hands as Record<PlayerId, ReadonlyArray<CardId>>,
		cardCounts: countsFor( hands ),
		moves
	},
	config: config( configOverrides ),
	context: {
		players: SEATS,
		currentPlayer: current,
		teams,
		turn: 0,
		...contextOverrides
	}
} );

/** A whole book laid out across the named seats. */
const spread = ( book: "TWOS" | "ACES", holders: ReadonlyArray<PlayerId> ) =>
	Object.fromEntries(
		getCardsOfBook( book ).map( ( card, i ) => [ card, holders[ i % holders.length ]! ] )
	);


describe( "fish rules", () => {

	describe( "askCard", () => {

		const table = () => at( {
			[ alice ]: [ "2H", "AH" ],
			[ bob ]: [ "2S", "3H" ],
			[ carol ]: [ "2C" ],
			[ dave ]: [ "2D", "AS" ]
		} );

		it( "accepts asking an opponent for a card of a book you hold", () => {
			assert.isUndefined( table().validate( "askCard", alice, { from: bob, cardId: "2S" } ) );
		} );

		it( "refuses asking a teammate", () => {
			const invalid = table().validate( "askCard", alice, { from: carol, cardId: "2C" } );
			assert.include( invalid?.reason ?? "", "only ask an opponent" );
		} );

		it( "refuses asking yourself", () => {
			// A seat is on its own side, so this is caught by the same rule.
			const invalid = table().validate( "askCard", alice, { from: alice, cardId: "2H" } );
			assert.include( invalid?.reason ?? "", "only ask an opponent" );
		} );

		it( "refuses asking a seat that has run out", () => {
			// Asking would burn a turn proving what the counts already say.
			const game = at( {
				[ alice ]: [ "2H" ],
				[ bob ]: [],
				[ carol ]: [ "2C" ],
				[ dave ]: [ "2D" ]
			} );

			const invalid = game.validate( "askCard", alice, { from: bob, cardId: "2S" } );
			assert.include( invalid?.reason ?? "", "no cards left" );
		} );

		it( "refuses asking for a card you already hold", () => {
			const invalid = table().validate( "askCard", alice, { from: bob, cardId: "2H" } );
			assert.include( invalid?.reason ?? "", "already hold that card" );
		} );

		it( "refuses asking in a book you hold no card of", () => {
			const invalid = table().validate( "askCard", alice, { from: bob, cardId: "3S" } );
			assert.include( invalid?.reason ?? "", "a book you hold a card of" );
		} );

		it( "refuses a card this variant deals no book for", () => {
			const game = at(
				{ [ alice ]: [ "AH" ], [ bob ]: [ "2S" ], [ carol ]: [], [ dave ]: [] },
				[],
				alice,
				{},
				fishConfigFor( 4, "CANADIAN", 2 )
			);

			// A seven is in no CANADIAN book at all.
			assert.isDefined( game.validate( "askCard", alice, { from: bob, cardId: "7S" } ) );
		} );

		it( "reads the outcome off the table rather than rolling for it", () => {
			const game = table();
			const hit = game.execute( "askCard", alice, { from: bob, cardId: "2S" } );
			const miss = game.execute( "askCard", alice, { from: bob, cardId: "2D" } );

			assert.isTrue( ( hit[ 0 ] as { ask: { success: boolean } } ).ask.success );
			assert.isFalse( ( miss[ 0 ] as { ask: { success: boolean } } ).ask.success );
		} );

		it( "moves the card and keeps the counts in step when it lands", () => {
			const game = table();
			game.play( "askCard", alice, { from: bob, cardId: "2S" } );

			assert.include( [ ...game.state.hands[ alice ]! ], "2S" );
			assert.notInclude( [ ...game.state.hands[ bob ]! ], "2S" );
			assert.strictEqual( game.state.cardCounts[ alice ], 3 );
			assert.strictEqual( game.state.cardCounts[ bob ], 1 );
		} );

		it( "moves nothing when it misses", () => {
			const game = table();
			game.play( "askCard", alice, { from: bob, cardId: "2D" } );

			assert.deepStrictEqual( [ ...game.state.hands[ alice ]! ], [ "2H", "AH" ] );
			assert.strictEqual( game.state.moves.length, 1 );
		} );
	} );

	describe( "claimBook", () => {

		const table = () => at( {
			[ alice ]: [ "2H", "2S" ],
			[ bob ]: [ "AH" ],
			[ carol ]: [ "2C", "2D" ],
			[ dave ]: [ "AS" ]
		} );

		it( "accepts a declaration naming the whole book across your own side", () => {
			const game = table();
			const claim = { "2H": alice, "2S": alice, "2C": carol, "2D": carol };

			assert.isUndefined( game.validate( "claimBook", alice, { claim } ) );
		} );

		it( "refuses a declaration that is not exactly one book", () => {
			const invalid = table().validate( "claimBook", alice, {
				claim: { "2H": alice, AH: alice }
			} );

			assert.include( invalid?.reason ?? "", "every card of exactly one book" );
		} );

		it( "refuses a book already declared", () => {
			const game = at(
				{ [ alice ]: [ "2H" ], [ bob ]: [ "AH" ], [ carol ]: [], [ dave ]: [] },
				[
					{
						_tag: "fish/Claim",
						success: true,
						playerId: alice,
						book: "TWOS",
						correctClaim: {},
						actualClaim: {}
					}
				]
			);

			const invalid = game.validate( "claimBook", alice, {
				claim: spread( "TWOS", [ alice ] )
			} );

			assert.include( invalid?.reason ?? "", "already been declared" );
		} );

		it( "refuses declaring a book you hold no card of", () => {
			const game = at( {
				[ alice ]: [ "AH" ],
				[ bob ]: [ "2S" ],
				[ carol ]: [ "2C", "2D", "2H" ],
				[ dave ]: []
			} );

			const invalid = game.validate( "claimBook", alice, {
				claim: { "2H": carol, "2S": carol, "2C": carol, "2D": carol }
			} );

			assert.include( invalid?.reason ?? "", "hold a card of" );
		} );

		it( "refuses naming an opponent as a holder", () => {
			// A rule rather than a losing move — and what makes a book a side holds
			// outright untakeable by anyone.
			const invalid = table().validate( "claimBook", alice, {
				claim: { "2H": alice, "2S": alice, "2C": carol, "2D": bob }
			} );

			assert.include( invalid?.reason ?? "", "only name your own side" );
		} );

		it( "records where the cards really were next to where they were said to be", () => {
			const game = table();
			const claim = { "2H": alice, "2S": alice, "2C": carol, "2D": carol };
			const events = game.execute( "claimBook", alice, { claim } );

			const recorded = ( events[ 0 ] as {
				claim: { success: boolean; correctClaim: unknown };
			} ).claim;
			assert.isTrue( recorded.success );
			assert.deepStrictEqual( recorded.correctClaim, claim );
		} );

		it( "marks a misplaced card a failure", () => {
			const game = table();
			const claim = { "2H": alice, "2S": carol, "2C": carol, "2D": alice };
			const events = game.execute( "claimBook", alice, { claim } );

			assert.isFalse( ( events[ 0 ] as { claim: { success: boolean } } ).claim.success );
		} );

		it( "empties the book from every hand, right or wrong", () => {
			const game = table();
			game.play( "claimBook", alice, {
				claim: { "2H": alice, "2S": carol, "2C": carol, "2D": alice }
			} );

			for ( const seat of SEATS ) {
				for ( const card of getCardsOfBook( "TWOS" ) ) {
					assert.notInclude( [ ...( game.state.hands[ seat ] ?? [] ) ], card );
				}
			}

			assert.strictEqual( game.state.cardCounts[ alice ], 0 );
			assert.strictEqual( game.state.cardCounts[ carol ], 0 );
		} );
	} );

	describe( "transferTurn", () => {

		const correct = ( playerId: PlayerId = alice ) => ( {
			_tag: "fish/Claim" as const,
			success: true,
			playerId,
			book: "TWOS" as const,
			correctClaim: {},
			actualClaim: {}
		} );

		const table = ( moves: FishState[ "moves" ] ) => at(
			{ [ alice ]: [ "AH" ], [ bob ]: [ "AS" ], [ carol ]: [ "AC" ], [ dave ]: [ "AD" ] },
			moves
		);

		it( "accepts it directly after your own correct declaration", () => {
			assert.isUndefined(
				table( [ correct() ] ).validate( "transferTurn", alice, { transferTo: carol } )
			);
		} );

		it( "refuses it with nothing behind it", () => {
			const invalid = table( [] ).validate( "transferTurn", alice, { transferTo: carol } );
			assert.include( invalid?.reason ?? "", "right after declaring a book correctly" );
		} );

		it( "refuses it once anything else has happened", () => {
			const moves: FishState[ "moves" ] = [
				correct(),
				{ _tag: "fish/Ask", success: true, playerId: bob, from: alice, cardId: "AH" }
			];

			assert.isDefined( table( moves ).validate( "transferTurn", alice, { transferTo: carol } ) );
		} );

		it( "refuses transferring to yourself", () => {
			const invalid = table( [ correct() ] ).validate( "transferTurn", alice, {
				transferTo: alice
			} );

			assert.include( invalid?.reason ?? "", "to a teammate" );
		} );

		it( "refuses transferring to an opponent", () => {
			const invalid = table( [ correct() ] ).validate( "transferTurn", alice, {
				transferTo: bob
			} );

			assert.include( invalid?.reason ?? "", "to a teammate" );
		} );

		it( "refuses transferring to a teammate who has run out", () => {
			const game = at(
				{ [ alice ]: [ "AH" ], [ bob ]: [ "AS" ], [ carol ]: [], [ dave ]: [ "AD" ] },
				[ correct() ]
			);

			const invalid = game.validate( "transferTurn", alice, { transferTo: carol } );
			assert.include( invalid?.reason ?? "", "no cards left" );
		} );

		it( "moves no cards — the turn is the engine's", () => {
			const game = table( [ correct() ] );
			game.play( "transferTurn", alice, { transferTo: carol } );

			assert.deepStrictEqual( [ ...game.state.hands[ alice ]! ], [ "AH" ] );
			assert.strictEqual( game.state.moves.at( -1 )?._tag, "fish/Transfer" );
		} );
	} );

	describe( "resolveNextPlayer", () => {

		const after = ( moves: FishState[ "moves" ], hands?: Record<string, ReadonlyArray<CardId>> ) =>
			at(
				hands ?? {
					[ alice ]: [ "AH" ],
					[ bob ]: [ "AS" ],
					[ carol ]: [ "AC" ],
					[ dave ]: [ "AD" ]
				},
				moves
			);

		const askMove = ( success: boolean, from: PlayerId = bob ) => ( {
			_tag: "fish/Ask" as const,
			success,
			playerId: alice,
			from,
			cardId: "2H" as CardId
		} );

		const claimMove = ( success: boolean, correctClaim = {} ) => ( {
			_tag: "fish/Claim" as const,
			success,
			playerId: alice,
			book: "TWOS" as const,
			correctClaim,
			actualClaim: {}
		} );

		it( "keeps the seat after a landed ask — the reward is another guess", () => {
			assert.strictEqual( after( [ askMove( true ) ] ).nextPlayer( alice, "askCard" ), alice );
		} );

		it( "hands it to the seat that was asked after a miss", () => {
			assert.strictEqual( after( [ askMove( false ) ] ).nextPlayer( alice, "askCard" ), bob );
		} );

		it( "keeps the seat after a correct declaration, for the transfer it earns", () => {
			assert.strictEqual( after( [ claimMove( true ) ] ).nextPlayer( alice, "claimBook" ), alice );
		} );

		it( "keeps it even with an empty hand, while the side still holds cards", () => {
			const game = after( [ claimMove( true ) ], {
				[ alice ]: [],
				[ bob ]: [ "AS" ],
				[ carol ]: [ "AC" ],
				[ dave ]: [ "AD" ]
			} );

			assert.strictEqual( game.nextPlayer( alice, "claimBook" ), alice );
		} );

		it( "falls through when the declaring side has nothing left to play", () => {
			// No transfer to make and no move to spend the turn on, so it moves on
			// rather than stalling the table for good.
			const game = after( [ claimMove( true ) ], {
				[ alice ]: [],
				[ bob ]: [ "AS" ],
				[ carol ]: [],
				[ dave ]: [ "AD" ]
			} );

			assert.oneOf( game.nextPlayer( alice, "claimBook" ), [ bob, dave ] );
		} );

		it( "hands a wrong declaration to the opposition", () => {
			const game = after( [ claimMove( false ) ] );
			assert.oneOf( game.nextPlayer( alice, "claimBook" ), [ bob, dave ] );
		} );

		it( "skips an opponent who has run out", () => {
			const game = after( [ claimMove( false ) ], {
				[ alice ]: [ "AH" ],
				[ bob ]: [],
				[ carol ]: [ "AC" ],
				[ dave ]: [ "AD" ]
			} );

			assert.strictEqual( game.nextPlayer( alice, "claimBook" ), dave );
		} );

		it( "hands a transfer to the named teammate", () => {
			const moves: FishState[ "moves" ] = [
				{ _tag: "fish/Transfer", playerId: alice, transferTo: carol }
			];

			assert.strictEqual( after( moves ).nextPlayer( alice, "transferTurn" ), carol );
		} );

		it( "gives the cursor back at a table where nobody holds anything", () => {
			// A table `endIf` has already ended.
			const game = after( [ askMove( false ) ], {
				[ alice ]: [],
				[ bob ]: [],
				[ carol ]: [],
				[ dave ]: []
			} );

			assert.strictEqual( game.nextPlayer( alice, "claimBook" ), alice );
		} );
	} );

	describe( "endIf", () => {

		it( "keeps going while a book is still in play", () => {
			assert.isFalse( at( { [ alice ]: [ "2H" ] } ).endIf() );
		} );

		it( "ends once every book has been declared", () => {
			const declared = config().books.map( book => ( {
				_tag: "fish/Claim" as const,
				success: true,
				playerId: alice,
				book,
				correctClaim: {},
				actualClaim: {}
			} ) );

			assert.isTrue( at( {}, declared ).endIf() );
		} );
	} );

	describe( "the view", () => {

		const table = () => at( {
			[ alice ]: [ "2H", "AH" ],
			[ bob ]: [ "2S" ],
			[ carol ]: [ "2C" ],
			[ dave ]: [ "2D" ]
		} );

		it( "gives a seat its own hand and everyone's counts", () => {
			const view = table().view( PlayerAudience.make( { playerId: alice } ) );

			// The hand comes back sorted the way the game sorts cards, not the way
			// the fixture happened to list them.
			assert.deepStrictEqual( [ ...view.hand ].sort(), [ "2H", "AH" ] );
			assert.deepStrictEqual( { ...view.cardCounts }, { alice: 2, bob: 1, carol: 1, dave: 1 } );
		} );

		it( "gives the table an empty hand and the same counts", () => {
			const view = table().view( TableAudience.make( {} ) );

			assert.deepStrictEqual( [ ...view.hand ], [] );
			assert.isUndefined( view.playerId );
			assert.deepStrictEqual( { ...view.cardCounts }, { alice: 2, bob: 1, carol: 1, dave: 1 } );
		} );

		it( "publishes the whole history — it is public knowledge", () => {
			const game = table();
			game.play( "askCard", alice, { from: bob, cardId: "2S" } );

			assert.strictEqual( game.view( TableAudience.make( {} ) ).moves.length, 1 );
		} );

		it( "keeps the metrics sealed until the last book is declared", () => {
			assert.isUndefined( table().view( TableAudience.make( {} ) ).metrics );
		} );

		it( "publishes them once it is", () => {
			const declared = config().books.map( book => ( {
				_tag: "fish/Claim" as const,
				success: true,
				playerId: alice,
				book,
				correctClaim: {},
				actualClaim: {}
			} ) );

			const view = at( {}, declared ).view( TableAudience.make( {} ) );
			assert.isDefined( view.metrics );
			assert.strictEqual( view.metrics?.[ alice ]?.totalClaims, config().books.length );
		} );
	} );

	describe( "resolveResults", () => {

		const declaredBy = ( playerId: PlayerId, book: "TWOS" | "ACES", success = true ) => ( {
			_tag: "fish/Claim" as const,
			success,
			playerId,
			book,
			correctClaim: success ? {} : spread( book, [ bob, dave ] ),
			actualClaim: {}
		} );

		it( "ranks the winning side first, everybody on it together", () => {
			// Fish is won together, so everyone on the winning side placed first.
			const results = at( {}, [ declaredBy( alice, "TWOS" ), declaredBy( carol, "ACES" ) ] )
				.results();

			assert.strictEqual( results?.winningTeam, ONE );
			assert.deepStrictEqual(
				results?.ranking.map( entry => [ entry.playerId, entry.rank ] ).sort(),
				[ [ alice, 1 ], [ bob, 2 ], [ carol, 1 ], [ dave, 2 ] ].sort()
			);
		} );

		it( "counts a book to a side once, not once per seat", () => {
			// Summing a per-seat score across a side would count each of its books
			// as many times as the side has seats.
			const results = at( {}, [ declaredBy( alice, "TWOS" ), declaredBy( carol, "ACES" ) ] )
				.results();
			const side = results?.teamRanking?.find( entry => entry.team === ONE );

			assert.strictEqual( side?.score, 2 );
		} );

		it( "credits a wrong declaration to the opposition", () => {
			const results = at( {}, [ declaredBy( alice, "TWOS", false ) ] ).results();

			assert.strictEqual( results?.winningTeam, TWO );
			assert.strictEqual(
				results?.teamRanking?.find( entry => entry.team === TWO )?.score,
				1
			);
		} );

		it( "scores each seat on the books it brought in itself", () => {
			const results = at( {}, [ declaredBy( alice, "TWOS" ), declaredBy( alice, "ACES" ) ] )
				.results();

			assert.strictEqual( results?.ranking.find( entry => entry.playerId === alice )?.score, 2 );
			assert.strictEqual( results?.ranking.find( entry => entry.playerId === carol )?.score, 0 );
		} );

		it( "stamps every standing with its side", () => {
			const results = at( {}, [ declaredBy( alice, "TWOS" ) ] ).results();

			assert.strictEqual( results?.ranking.find( entry => entry.playerId === alice )?.team, ONE );
			assert.strictEqual( results?.ranking.find( entry => entry.playerId === bob )?.team, TWO );
		} );
	} );

	describe( "botMove", () => {

		it( "plays only a move the rules would accept", () => {
			const game = at( {
				[ alice ]: [ "2H", "AH" ],
				[ bob ]: [ "2S", "AS" ],
				[ carol ]: [ "2C", "AC" ],
				[ dave ]: [ "2D", "AD" ]
			} );

			const choice = game.bot( PlayerAudience.make( { playerId: alice } ) );
			assert.isDefined( choice );
			assert.isUndefined(
				game.validate( choice!.moveType as "askCard", alice, choice!.input as never )
			);
		} );
	} );
} );
