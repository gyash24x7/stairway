import * as Match from "effect/Match";
import { produce } from "immer";

import {
	checkWinner,
	findBestMove,
	isBoardFull,
	symbolOf
} from "@/games/tictactoe/server/utils.ts";
import {
	Placed,
	PlaceInput,
	SymbolAssigned,
	TICTACTOE_BOARD_SIZE,
	TicTacToeConfig,
	TicTacToeEvent,
	TicTacToeState,
	TicTacToeView
} from "@/games/tictactoe/shared/schema.ts";
import { makeEngine } from "@/swish/server/engine.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import { InvalidMove } from "@/swish/shared/schema.ts";

// --- Engine ----------------------------------------------------------------

export const tictactoe = makeEngine( {
	name: "tictactoe",
	schemas: {
		state: TicTacToeState,
		config: TicTacToeConfig,
		events: TicTacToeEvent,
		view: TicTacToeView,
		moves: {
			place: PlaceInput
		}
	},

	setup: () => TicTacToeState.make( {
		board: Array.from( { length: TICTACTOE_BOARD_SIZE }, () => null ),
		symbols: {}
	} ),

	apply: ( state, event ) => produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "tictactoe/ev/SymbolAssigned", ( e ) => {
				draft.symbols[ e.symbol ] = e.playerId;
			} ),
			Match.tag( "tictactoe/ev/Placed", ( e ) => {
				draft.board[ e.position ] = e.symbol;
			} ),
			Match.exhaustive
		);
	} ),

	endIf: ( { state } ) => checkWinner( state.board ) !== null || isBoardFull( state.board ),

	view: ( { state }, audience ) => TicTacToeView.make( {
		...state,
		playerId: playerIdFor( audience )
	} ),

	resolveResults: ( { state, context } ) => {
		const winnerSymbol = checkWinner( [ ...state.board ] );
		const winner = winnerSymbol ? state.symbols[ winnerSymbol ] : undefined;

		const ranking = context.players.map( playerId => ( {
			playerId,
			rank: !winner || playerId === winner ? 1 : 2
		} ) );

		return { ranking, winner };
	},

	// How the game came out is `resolveResults`' answer alone — there is no `onEnd`
	// writing a second copy of it into the state for a client to read instead.
	hooks: {
		onJoin: ( { state }, playerId ) => [
			SymbolAssigned.make( {
				symbol: state.symbols.X ? "O" : "X",
				playerId
			} )
		]
	},

	moves: {
		place: {
			validate: ( { state }, _playerId, { position } ) => {
				if ( state.board[ position ] !== null ) {
					return new InvalidMove( {
						move: "place",
						reason: "Cell is already occupied."
					} );
				}

				return;
			},

			execute: ( { state }, playerId, { position } ) => [
				Placed.make( { position, symbol: symbolOf( state.symbols, playerId ) } )
			]
		}
	},

	botMove: ( { state } ) => {
		const position = findBestMove(
			[ ...state.board ],
			symbolOf( state.symbols, state.playerId! )
		);

		return { moveType: "place" as const, input: { position } };
	}
} );
