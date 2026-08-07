import { describe, expect, test } from "bun:test";

import {
	apply,
	checkWinner,
	findBestMove,
	GAME_NAME,
	isBoardFull,
	symbolOf,
	WINNING_LINES
} from "@/games/tictactoe/server/utils.ts";
import {
	Placed,
	SymbolAssigned,
	type CellValue,
	type TicTacToeState,
	WinnerDecided
} from "@/games/tictactoe/shared/schema.ts";
import { PlayerId } from "@/shared/swish/schema.ts";

/** The two marks a cell can hold — `CellValue` minus the empty cell. */
type Mark = NonNullable<CellValue>;

const P1 = PlayerId.make( "p1" );
const P2 = PlayerId.make( "p2" );

const EMPTY_BOARD = Array.from( { length: 9 }, () => null as CellValue );

/** A board with the given marks placed by index; every other cell is empty. */
const boardOf = ( marks: Record<number, Mark> ) =>
	Array.from( { length: 9 }, ( _, i ) => marks[ i ] ?? null );

/** The genesis state `setup` produces: an empty board and unassigned symbols. */
const emptyState = () => ( {
	board: [ ...EMPTY_BOARD ],
	symbols: { X: PlayerId.make( "" ), O: PlayerId.make( "" ) }
} ) as TicTacToeState;

const other = ( mark: Mark ) => mark === "X" ? "O" : "X";

/**
 * Plays out EVERY line the opponent could choose against the bot's minimax,
 * returning `false` the moment the bot loses one of them. The bot's own reply is
 * forced (minimax is deterministic), so the tree only branches on the opponent.
 */
const botNeverLoses = ( botSymbol: Mark ) => {
	// The annotation sits on the binding, not the arrow: `walk` recurses, so its
	// return type cannot be inferred from the body alone.
	const walk: ( board: Array<CellValue>, toMove: Mark ) => boolean = ( board, toMove ) => {
		const winner = checkWinner( board );
		if ( winner ) {
			return winner === botSymbol;
		}

		if ( isBoardFull( board ) ) {
			return true;
		}

		if ( toMove === botSymbol ) {
			const position = findBestMove( board, botSymbol );
			board[ position ] = botSymbol;
			const survived = walk( board, other( botSymbol ) );
			board[ position ] = null;
			return survived;
		}

		for ( let i = 0; i < 9; i++ ) {
			if ( board[ i ] !== null ) {
				continue;
			}

			board[ i ] = toMove;
			const survived = walk( board, botSymbol );
			board[ i ] = null;
			if ( !survived ) {
				return false;
			}
		}

		return true;
	};

	// "X" always moves first, whichever symbol the bot holds.
	return walk( [ ...EMPTY_BOARD ], "X" );
};

// ===========================================================================
describe( "tictactoe utils — apply (pure reducer)", () => {
	test( "SymbolAssigned seats a player on one of the two symbols", () => {
		const withX = apply( emptyState(), SymbolAssigned.make( { symbol: "X", playerId: P1 } ) );
		const withBoth = apply( withX, SymbolAssigned.make( { symbol: "O", playerId: P2 } ) );

		expect( withBoth.symbols ).toEqual( { X: P1, O: P2 } );
	} );

	test( "Placed writes the symbol into its cell and leaves the rest empty", () => {
		const next = apply( emptyState(), Placed.make( { position: 4, symbol: "X" } ) );

		expect( next.board ).toEqual( boardOf( { 4: "X" } ) );
	} );

	test( "WinnerDecided records the outcome", () => {
		expect( apply( emptyState(), WinnerDecided.make( { winner: P1 } ) ).winner ).toBe( P1 );
		expect( apply( emptyState(), WinnerDecided.make( { winner: "draw" } ) ).winner ).toBe( "draw" );
	} );

	test( "apply never mutates the state it is handed", () => {
		const state = emptyState();
		const next = apply( state, Placed.make( { position: 0, symbol: "O" } ) );

		expect( state.board ).toEqual( EMPTY_BOARD );
		expect( next ).not.toBe( state );
	} );

	test( "folding a sequence of events is deterministic", () => {
		const events = [
			SymbolAssigned.make( { symbol: "X", playerId: P1 } ),
			SymbolAssigned.make( { symbol: "O", playerId: P2 } ),
			Placed.make( { position: 0, symbol: "X" } ),
			Placed.make( { position: 4, symbol: "O" } ),
			Placed.make( { position: 1, symbol: "X" } )
		];

		const fold = () => events.reduce( apply, emptyState() );
		expect( fold() ).toEqual( fold() );
		expect( fold().board ).toEqual( boardOf( { 0: "X", 1: "X", 4: "O" } ) );
	} );
} );

// ===========================================================================
describe( "tictactoe utils — symbolOf", () => {
	const symbols = { X: P1, O: P2 };

	test( "resolves the symbol each seated player holds", () => {
		expect( symbolOf( symbols, P1 ) ).toBe( "X" );
		expect( symbolOf( symbols, P2 ) ).toBe( "O" );
	} );

	test( "anyone who is not X is treated as O", () => {
		// Documents the shape of the helper: it is an identity test against X only,
		// so it is only ever safe to call with a seated player.
		expect( symbolOf( symbols, PlayerId.make( "p9" ) ) ).toBe( "O" );
	} );
} );

// ===========================================================================
describe( "tictactoe utils — checkWinner", () => {
	test( "an empty board has no winner", () => {
		expect( checkWinner( EMPTY_BOARD ) ).toBeNull();
	} );

	test( "the eight winning lines are the three rows, three columns and both diagonals", () => {
		expect( WINNING_LINES ).toEqual( [
			[ 0, 1, 2 ], [ 3, 4, 5 ], [ 6, 7, 8 ],
			[ 0, 3, 6 ], [ 1, 4, 7 ], [ 2, 5, 8 ],
			[ 0, 4, 8 ], [ 2, 4, 6 ]
		] );
	} );

	for ( const line of WINNING_LINES ) {
		for ( const mark of [ "X", "O" ] as const ) {
			test( `${ mark } wins on line ${ line.join( "-" ) }`, () => {
				const marks = Object.fromEntries( line.map( ( i ) => [ i, mark ] ) );
				expect( checkWinner( boardOf( marks ) ) ).toBe( mark );
			} );
		}
	}

	test( "a full board with no line has no winner", () => {
		// X: 0,1,5,6,7 — O: 2,3,4,8. Every line is broken.
		const board = boardOf( {
			0: "X", 1: "X", 2: "O",
			3: "O", 4: "O", 5: "X",
			6: "X", 7: "X", 8: "O"
		} );

		expect( isBoardFull( board ) ).toBe( true );
		expect( checkWinner( board ) ).toBeNull();
	} );

	test( "two of a line is not a win", () => {
		expect( checkWinner( boardOf( { 0: "X", 1: "X" } ) ) ).toBeNull();
	} );

	test( "a line split between both players is not a win", () => {
		expect( checkWinner( boardOf( { 0: "X", 1: "O", 2: "X" } ) ) ).toBeNull();
	} );
} );

// ===========================================================================
describe( "tictactoe utils — isBoardFull", () => {
	test( "an empty board is not full", () => {
		expect( isBoardFull( EMPTY_BOARD ) ).toBe( false );
	} );

	test( "one empty cell keeps the board open", () => {
		const board = boardOf( {
			0: "X", 1: "O", 2: "X",
			3: "X", 4: "O", 5: "O",
			6: "O", 7: "X"
		} );

		expect( isBoardFull( board ) ).toBe( false );
	} );

	test( "every cell occupied is full", () => {
		const board = Array.from( { length: 9 }, () => "X" as CellValue );
		expect( isBoardFull( board ) ).toBe( true );
	} );
} );

// ===========================================================================
describe( "tictactoe utils — findBestMove (minimax)", () => {
	test( "takes an immediate win over any other cell", () => {
		// O holds 2 and 4; 6 completes the 2-4-6 diagonal.
		const board = boardOf( { 0: "X", 1: "X", 2: "O", 3: "X", 4: "O" } );
		expect( findBestMove( board, "O" ) ).toBe( 6 );
	} );

	test( "prefers its own win to blocking the opponent's", () => {
		// X threatens 0-1-2 at 2; O threatens 3-4-5 at 5. O is to move: winning beats blocking.
		const board = boardOf( { 0: "X", 1: "X", 3: "O", 4: "O" } );
		expect( findBestMove( board, "O" ) ).toBe( 5 );
	} );

	test( "blocks an immediate loss when it has no win of its own", () => {
		// X threatens 0-1-2 at 2; O has nothing.
		const board = boardOf( { 0: "X", 1: "X", 4: "O" } );
		expect( findBestMove( board, "O" ) ).toBe( 2 );
	} );

	test( "answers a corner opening with the centre — the only non-losing reply", () => {
		expect( findBestMove( boardOf( { 0: "X" } ), "O" ) ).toBe( 4 );
	} );

	test( "opens deterministically on an empty board", () => {
		// Every opening draws under perfect play, so the scan keeps its first candidate.
		expect( findBestMove( [ ...EMPTY_BOARD ], "X" ) ).toBe( 0 );
	} );

	test( "returns -1 when there is no cell left to take", () => {
		const board = Array.from( { length: 9 }, () => "X" as CellValue );
		expect( findBestMove( board, "O" ) ).toBe( -1 );
	} );

	test( "playing second, the bot loses to no opponent line", () => {
		expect( botNeverLoses( "O" ) ).toBe( true );
	} );

	test( "playing first, the bot loses to no opponent line", () => {
		expect( botNeverLoses( "X" ) ).toBe( true );
	} );
} );

// ===========================================================================
describe( "tictactoe utils — registry", () => {
	test( "the slug matches the engine name the DO is keyed by", () => {
		expect( GAME_NAME ).toBe( "tic-tac-toe" );
	} );
} );
