import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import {
	PlaceInput,
	TicTacToeConfig,
	TicTacToeCreateInput,
	TicTacToeMoveSchemas,
	TicTacToeView
} from "@/games/tictactoe/schema";
import {
	AddBotsApiEndpoint,
	AutoPlayApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	HintApiEndpoint,
	JoinGameApiEndpoint,
	MoveApiEndpoint,
	RedoApiEndpoint,
	RematchApiEndpoint,
	SpectateApiEndpoint,
	StartGameApiEndpoint,
	SubscribeApiEndpoint,
	UndoApiEndpoint
} from "@/swish/endpoints";


// --- TicTacToe Endpoints ---------------------------------------------------------

const TicTacToeApiGroup = HttpApiGroup.make( "tictactoe" )
	.add(
		CreateGameApiEndpoint( TicTacToeCreateInput ),
		GetViewApiEndpoint( TicTacToeView, TicTacToeConfig ),
		SubscribeApiEndpoint( TicTacToeView, TicTacToeConfig ),
		JoinGameApiEndpoint(),
		SpectateApiEndpoint(),
		StartGameApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "place", PlaceInput ),
		HintApiEndpoint( TicTacToeMoveSchemas ),
		AutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.middleware( AuthMiddleware )
	.prefix( "/tictactoe" );

export const TicTacToeApi = HttpApi.make( "api" ).add( TicTacToeApiGroup ).prefix( "/api" );
