import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { fish } from "@/games/fish/server/engine.ts";
import { asksOf, buildConfig } from "@/games/fish/server/utils.ts";
import { claimsOf, getCardsOfBook } from "@/games/fish/shared/utils.ts";
import type { GameContext, PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { opponentsOf, teamMatesOf } from "@/swish/shared/teams.ts";
import { createInput, runGame } from "@tests/helpers/runner.ts";

import type { BookType, Claim, FishState, PlayerCount } from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";

const seat = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const seats = ( count: number ) =>
	Array.from( { length: count }, ( _, index ) => PlayerId.make( `p${ index }` ) );

type StoredRecord = { readonly version: number; readonly state: FishState };

/**
 * The table as one test needs it: a real dealt game, with the hands rewritten
 * afterwards to whatever position the rule under test is about.
 *
 * Rewriting the stored record rather than playing towards a position is what
 * makes each rule reachable on its own — a fresh deal cannot be asked to produce
 * an empty hand or a book already declared, and playing until it does would test
 * the bot rather than the rule.
 */
const riggedTable = <A, E>(
	count: PlayerCount,
	type: BookType,
	rig: (
		context: GameContext,
		state: FishState
	) => Partial<FishState>,
	body: (
		engine: Effect.Success<typeof fish>,
		context: GameContext,
		state: FishState
	) => Effect.Effect<A, E>
) => {
	const cells = new Map<string, unknown>();
	const players = seats( count );

	return runGame( fish, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( buildConfig( count, type, 2 ), players[ 0 ] ) );
		yield* Effect.forEach( players, id => engine.join( seat( id ) ) );
		yield* engine.start( players[ 0 ]! );

		const opened = yield* engine.getState();
		const record = cells.get( "data" ) as StoredRecord;
		const rigged = { ...record.state, ...rig( opened.context, record.state ) };

		cells.set( "data", { ...record, state: rigged } );

		return yield* body( engine, opened.context, rigged );
	} ), { cells } );
};

/** Counts derived from the hands, so a rigged table stays self-consistent. */
const countsOf = ( hands: Record<Player, ReadonlyArray<CardId>> ) =>
	Object.fromEntries(
		Object.entries( hands ).map( ( [ id, hand ] ) => [ id, hand.length ] )
	) as Record<Player, number>;

/**
 * Clears a book out of every hand before a test deals it deliberately. Without
 * this a seat the test never named could still be holding one of the book's
 * cards from the real deal, and whether a declaration came out right would turn
 * on the seed.
 *
 * @param hands - The hands as dealt.
 * @param book - The book to take out of circulation.
 * @returns The same hands with none of that book's cards in them.
 */
const withoutBook = ( hands: FishState[ "hands" ], book: string ) => {
	const cards = getCardsOfBook( book as Claim[ "book" ] );

	return Object.fromEntries(
		Object.entries( hands ).map(
			( [ id, hand ] ) => [ id, hand.filter( card => !cards.includes( card ) ) ]
		)
	) as Record<Player, CardId[]>;
};

/** A declaration of a book, as the history records one. */
const claimOf = ( playerId: Player, book: string ): Claim => ( {
	_tag: "fish/Claim",
	success: true,
	playerId,
	book: book as Claim[ "book" ],
	correctClaim: {},
	actualClaim: {}
} );

const reasonOf = ( error: unknown ) => ( error as { readonly reason: string } ).reason;


describe( "asking for a card", () => {
	test( "refuses a seat holding nothing", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const hands = { ...state.hands, [ context.currentPlayer ]: [] };
				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context, state ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				const card = state.hands[ target ]![ 0 ]!;
				return engine
					.askCard( { from: target, cardId: card }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( reasonOf( result ) ).toBe( "You have no cards! Transfer your turn instead." );
	} );

	test( "refuses an ask aimed at a teammate", () => {
		const { result } = riggedTable(
			4, "NORMAL", () => ( {} ),
			( engine, context, state ) => {
				const mate = teamMatesOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.askCard( { from: mate, cardId: state.hands[ mate ]![ 0 ]! }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "You can only ask opponents for cards!" );
	} );

	test( "refuses an ask aimed at a seat holding nothing", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				const hands = { ...state.hands, [ target ]: [] };
				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.askCard( { from: target, cardId: "AH" }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "That player has no cards left!" );
	} );

	test( "refuses a card this variant's deck does not hold", () => {
		// A seven has no book in a canadian game, so it is not a card to ask for.
		const { result } = riggedTable(
			6, "CANADIAN", () => ( {} ),
			( engine, context ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.askCard( { from: target, cardId: "7C" }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "That card is not in this game's deck!" );
	} );

	test( "refuses an ask for a book the seat holds no card of", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				// The asker holds only twos, so nothing entitles it to ask for an ace.
				const hands = { ...state.hands, [ context.currentPlayer ]: [ "2C" ] as CardId[] };
				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.askCard( { from: target, cardId: "AH" }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "You must hold atleast 1 card from the book!" );
	} );

	test( "refuses an ask for a card the seat already holds", () => {
		const { result } = riggedTable(
			4, "NORMAL", () => ( {} ),
			( engine, context, state ) => {
				const own = state.hands[ context.currentPlayer ]![ 0 ]!;
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.askCard( { from: target, cardId: own }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "You already have this card!" );
	} );

	test( "refuses an ask for a book that has already been declared", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const hands = {
					...state.hands,
					[ context.currentPlayer ]: [ "AC" ] as CardId[]
				};

				return {
					hands,
					cardCounts: countsOf( hands ),
					moves: [ claimOf( context.currentPlayer, "ACES" ) ]
				};
			},
			( engine, context ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.askCard( { from: target, cardId: "AH" }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "This book has already been claimed!" );
	} );

	test( "accepts a legal ask, and a hit keeps the turn", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				const hands = {
					...state.hands,
					[ context.currentPlayer ]: [ "AC" ] as CardId[],
					[ target ]: [ "AH" ] as CardId[]
				};

				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => Effect.gen( function* () {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				yield* engine.askCard( { from: target, cardId: "AH" }, context.currentPlayer );
				return { asker: context.currentPlayer, view: yield* engine.getState() };
			} )
		);

		expect( result.view.context.currentPlayer ).toBe( result.asker );
		expect( asksOf( result.view.view )[ 0 ]?.success ).toBe( true );
	} );

	test( "a miss hands the turn to whoever was asked", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				const hands = {
					...state.hands,
					[ context.currentPlayer ]: [ "AC" ] as CardId[],
					[ target ]: [ "2H" ] as CardId[]
				};

				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => Effect.gen( function* () {
				const target = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				yield* engine.askCard( { from: target, cardId: "AH" }, context.currentPlayer );
				return { target, view: yield* engine.getState() };
			} )
		);

		expect( result.view.context.currentPlayer ).toBe( result.target );
	} );
} );


describe( "declaring a book", () => {
	/** A claim naming the caller as holder of every card of a book. */
	const wholeBook = ( book: string, holder: Player ) =>
		Object.fromEntries( getCardsOfBook( book as Claim[ "book" ] ).map( card => [ card, holder ] ) );

	test( "refuses an empty claim", () => {
		const { result } = riggedTable(
			4, "NORMAL", () => ( {} ),
			( engine, context ) =>
				engine.claimBook( { claim: {} }, context.currentPlayer ).pipe( Effect.flip )
		);

		expect( reasonOf( result ) ).toBe( "Claim cannot be empty!" );
	} );

	test( "refuses a claim naming a card this variant's deck does not hold", () => {
		const { result } = riggedTable(
			6, "CANADIAN", () => ( {} ),
			( engine, context ) => engine
				.claimBook( { claim: { "7C": context.currentPlayer } }, context.currentPlayer )
				.pipe( Effect.flip )
		);

		expect( reasonOf( result ) ).toBe( "Claim contains a card that is not in this game's deck!" );
	} );

	test( "refuses a claim spanning more than one book", () => {
		const { result } = riggedTable(
			4, "NORMAL", () => ( {} ),
			( engine, context ) => engine
				.claimBook(
					{ claim: { AH: context.currentPlayer, "2H": context.currentPlayer } },
					context.currentPlayer
				)
				.pipe( Effect.flip )
		);

		expect( reasonOf( result ) ).toBe( "All cards must belong to the same book!" );
	} );

	test( "refuses a book that has already been declared", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context ) => ( { moves: [ claimOf( context.currentPlayer, "ACES" ) ] } ),
			( engine, context ) => engine
				.claimBook( { claim: wholeBook( "ACES", context.currentPlayer ) }, context.currentPlayer )
				.pipe( Effect.flip )
		);

		expect( reasonOf( result ) ).toBe( "This book has already been claimed!" );
	} );

	test( "refuses a book the seat holds no card of", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const hands = { ...state.hands, [ context.currentPlayer ]: [ "2C" ] as CardId[] };
				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => engine
				.claimBook( { claim: wholeBook( "ACES", context.currentPlayer ) }, context.currentPlayer )
				.pipe( Effect.flip )
		);

		expect( reasonOf( result ) ).toBe( "You must hold atleast 1 card from the book!" );
	} );

	test( "refuses a claim short of the whole book", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const hands = { ...state.hands, [ context.currentPlayer ]: [ "AC" ] as CardId[] };
				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => engine
				.claimBook(
					{ claim: { AC: context.currentPlayer, AH: context.currentPlayer } },
					context.currentPlayer
				)
				.pipe( Effect.flip )
		);

		expect( reasonOf( result ) ).toBe( "Must claim all 4 cards in the book!" );
	} );

	test( "refuses a claim naming somebody who is not at the table", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const hands = { ...state.hands, [ context.currentPlayer ]: [ "AC" ] as CardId[] };
				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => {
				const stranger = PlayerId.make( "stranger" );
				const claim = { ...wholeBook( "ACES", context.currentPlayer ), AH: stranger };
				return engine.claimBook( { claim }, context.currentPlayer ).pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toContain( "is not in this game!" );
	} );

	test( "refuses a claim naming an opponent as a holder", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const hands = { ...state.hands, [ context.currentPlayer ]: [ "AC" ] as CardId[] };
				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => {
				const rival = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				const claim = { ...wholeBook( "ACES", context.currentPlayer ), AH: rival };
				return engine.claimBook( { claim }, context.currentPlayer ).pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "You can only claim cards held by your own team!" );
	} );

	test( "a correct declaration takes the book and keeps the turn", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const mate = teamMatesOf( context, context.currentPlayer )[ 0 ]!;
				// The caller keeps a card outside the book, so taking the book does
				// not leave them with nothing and pass the turn on anyway.
				const hands = {
					...withoutBook( state.hands, "ACES" ),
					[ context.currentPlayer ]: [ "AC", "AD", "2C" ] as CardId[],
					[ mate ]: [ "AH", "AS" ] as CardId[]
				};

				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => Effect.gen( function* () {
				const caller = context.currentPlayer;
				const mate = teamMatesOf( context, caller )[ 0 ]!;
				yield* engine.claimBook( {
					claim: { AC: caller, AD: caller, AH: mate, AS: mate }
				}, caller );

				return { caller, view: yield* engine.getState() };
			} )
		);

		const claim = claimsOf( result.view.view )[ 0 ]!;

		expect( claim.success ).toBe( true );
		expect( claim.book ).toBe( "ACES" );
		expect( result.view.context.currentPlayer ).toBe( result.caller );
	} );

	test( "a wrong declaration still takes the book off the table, and loses the turn", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const caller = context.currentPlayer;
				const mate = teamMatesOf( context, caller )[ 0 ]!;
				const rival = opponentsOf( context, caller )[ 0 ]!;
				const hands = {
					...withoutBook( state.hands, "ACES" ),
					[ caller ]: [ "AC", "2C" ] as CardId[],
					[ mate ]: [ "AH" ] as CardId[],
					[ rival ]: [ "AD", "AS", "2D" ] as CardId[]
				};

				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => Effect.gen( function* () {
				const caller = context.currentPlayer;
				const mate = teamMatesOf( context, caller )[ 0 ]!;
				const rival = opponentsOf( context, caller )[ 0 ]!;
				// The rival holds two of them, so naming only the side is wrong.
				yield* engine.claimBook( {
					claim: { AC: caller, AD: mate, AH: mate, AS: caller }
				}, caller );

				return { caller, rival, view: yield* engine.getState() };
			} )
		);

		const claim = claimsOf( result.view.view )[ 0 ]!;

		expect( claim.success ).toBe( false );
		// A bad declaration gives the turn to the other side.
		expect( result.view.context.currentPlayer ).toBe( result.rival );
	} );
} );


describe( "handing the turn to a teammate", () => {
	test( "refuses it when the last move was not a successful declaration", () => {
		const { result } = riggedTable(
			4, "NORMAL", () => ( {} ),
			( engine, context ) => {
				const mate = teamMatesOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.transferTurn( { transferTo: mate }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "You can only transfer turn after a successful claim!" );
	} );

	test( "refuses a transfer to an opponent", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => ( {
				moves: [ ...state.moves, claimOf( context.currentPlayer, "ACES" ) ]
			} ),
			( engine, context ) => {
				const rival = opponentsOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.transferTurn( { transferTo: rival }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "You can only transfer to a teammate!" );
	} );

	test( "refuses a transfer to a teammate holding nothing", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const mate = teamMatesOf( context, context.currentPlayer )[ 0 ]!;
				const hands = { ...state.hands, [ mate ]: [] };

				return {
					hands,
					cardCounts: countsOf( hands ),
					moves: [ ...state.moves, claimOf( context.currentPlayer, "ACES" ) ]
				};
			},
			( engine, context ) => {
				const mate = teamMatesOf( context, context.currentPlayer )[ 0 ]!;
				return engine
					.transferTurn( { transferTo: mate }, context.currentPlayer )
					.pipe( Effect.flip );
			}
		);

		expect( reasonOf( result ) ).toBe( "Cannot transfer to a teammate with no cards!" );
	} );

	test( "hands the turn where it was addressed", () => {
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => ( {
				moves: [ ...state.moves, claimOf( context.currentPlayer, "ACES" ) ]
			} ),
			( engine, context ) => Effect.gen( function* () {
				const mate = teamMatesOf( context, context.currentPlayer )[ 0 ]!;
				yield* engine.transferTurn( { transferTo: mate }, context.currentPlayer );
				return { mate, view: yield* engine.getState() };
			} )
		);

		expect( result.view.context.currentPlayer ).toBe( result.mate );
		expect( result.view.view.moves.filter( m => m._tag === "fish/Transfer" ) ).toHaveLength( 1 );
	} );
} );


describe( "a turn handed to a seat that cannot take it", () => {
	test( "passes to a teammate still holding cards", () => {
		// A correct declaration keeps the turn — but this one empties the caller's
		// hand, and a seat with nothing left cannot play, so it goes to their side.
		const { result } = riggedTable(
			4, "NORMAL",
			( context, state ) => {
				const caller = context.currentPlayer;
				const mate = teamMatesOf( context, caller )[ 0 ]!;
				const hands = {
					...withoutBook( state.hands, "ACES" ),
					[ caller ]: [ "AC", "AD" ] as CardId[],
					[ mate ]: [ "AH", "AS", "2C" ] as CardId[]
				};

				return { hands, cardCounts: countsOf( hands ) };
			},
			( engine, context ) => Effect.gen( function* () {
				const caller = context.currentPlayer;
				const mate = teamMatesOf( context, caller )[ 0 ]!;

				yield* engine.claimBook( {
					claim: { AC: caller, AD: caller, AH: mate, AS: mate }
				}, caller );

				return { mate, view: yield* engine.getState() };
			} )
		);

		expect( claimsOf( result.view.view )[ 0 ]?.success ).toBe( true );
		expect( result.view.context.currentPlayer ).toBe( result.mate );
	} );
} );
