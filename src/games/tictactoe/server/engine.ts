import * as Match from "effect/Match";

import { produce } from "immer";

import {
	Placed,
	SymbolAssigned,
	TICTACTOE_BOARD_SIZE,
	TICTACTOE_BOT_DELAY_MILLIS,
	TICTACTOE_MOVE_TIMEOUT_MILLIS,
	TICTACTOE_PLAYER_COUNT,
	TicTacToeConfig,
	TicTacToeEvent,
	TicTacToeMoveSchemas,
	TicTacToeState,
	TicTacToeView
} from "@/games/tictactoe/schema";
import { checkWinner, findBestMove, isBoardFull, symbolOf } from "@/games/tictactoe/utils";
import { InvalidMove } from "@/swish/errors";
import { Standing, Standings } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { playerIdFor } from "@/swish/utils";

// --- Engine ----------------------------------------------------------------

export const {
	Engine: TicTacToeEngine,
	EngineLive: TicTacToeEngineLive,
	Structure: TicTacToeStructure
} = makeEngine( {
	name: "tictactoe",
	schemas: {
		state: TicTacToeState,
		config: TicTacToeConfig,
		events: TicTacToeEvent,
		view: TicTacToeView,
		moves: TicTacToeMoveSchemas
	},

	defaultConfig: () => TicTacToeConfig.make( {
		playerCount: TICTACTOE_PLAYER_COUNT,
		autoStart: true,
		botDelayMillis: TICTACTOE_BOT_DELAY_MILLIS,
		moveTimeoutMillis: TICTACTOE_MOVE_TIMEOUT_MILLIS
	} ),

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

		const ranking = context.players.map( playerId => Standing.make( {
			playerId,
			rank: !winner || playerId === winner ? 1 : 2
		} ) );

		return Standings.make( { ranking, winner } );
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
