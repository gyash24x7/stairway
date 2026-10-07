import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import {
	BlockStealInput,
	CoupConfig,
	CoupCreateInput,
	CoupMoveSchemas,
	CoupView,
	ExchangeReturnInput,
	NoInput,
	RevealInput,
	TargetInput
} from "@/games/coup/schema";
import {
	AddBotsApiEndpoint,
	AutoPlayApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	HintApiEndpoint,
	JoinGameApiEndpoint,
	MoveApiEndpoint,
	PassApiEndpoint,
	RematchApiEndpoint,
	RespondApiEndpoint,
	SpectateApiEndpoint,
	StartGameApiEndpoint,
	SubscribeApiEndpoint
} from "@/swish/endpoints";


// --- Coup Endpoints --------------------------------------------------------

/**
 * The HTTP surface of a Coup table.
 *
 * Seven turn actions and six responses, split across the two move builders. The
 * split is not about the engine — one command serves both, and which one a move
 * turns out to be is decided by whether a window is open when it arrives — but
 * about the caller: a response carries `?frame=<id>` naming the window it is
 * answering, so a click made against a window that has since settled is refused
 * instead of applied to whatever replaced it.
 *
 * `pass` is the engine's own, and is how everything optional gets declined: not
 * challenging a Duke, not blocking a Steal. There is no per-action "allow" move,
 * because passing is the same act whatever it is passing on.
 *
 * Undo and redo are deliberately absent. Coup is played over hidden information,
 * and a take-back after seeing who challenged — or seeing which card came back
 * off a proven claim — would turn the history into a way of asking the table a
 * question for free. Leaving the endpoints out of this group is the whole opt-out;
 * the engine needs no flag for it.
 */
const CoupApiGroup = HttpApiGroup.make( "coup" )
	.add(
		CreateGameApiEndpoint( CoupCreateInput ),
		GetViewApiEndpoint( CoupView, CoupConfig ),
		SubscribeApiEndpoint( CoupView, CoupConfig ),
		JoinGameApiEndpoint(),
		SpectateApiEndpoint(),
		StartGameApiEndpoint(),
		AddBotsApiEndpoint(),
		HintApiEndpoint( CoupMoveSchemas ),
		AutoPlayApiEndpoint(),
		RematchApiEndpoint(),

		MoveApiEndpoint( "income", NoInput ),
		MoveApiEndpoint( "foreignAid", NoInput ),
		MoveApiEndpoint( "coup", TargetInput ),
		MoveApiEndpoint( "tax", NoInput ),
		MoveApiEndpoint( "assassinate", TargetInput ),
		MoveApiEndpoint( "steal", TargetInput ),
		MoveApiEndpoint( "exchange", NoInput ),

		RespondApiEndpoint( "challenge", NoInput ),
		RespondApiEndpoint( "blockForeignAid", NoInput ),
		RespondApiEndpoint( "blockAssassination", NoInput ),
		RespondApiEndpoint( "blockSteal", BlockStealInput ),
		RespondApiEndpoint( "reveal", RevealInput ),
		RespondApiEndpoint( "exchangeReturn", ExchangeReturnInput ),

		PassApiEndpoint()
	)
	.middleware( AuthMiddleware )
	.prefix( "/coup" );

export const CoupApi = HttpApi.make( "api" ).add( CoupApiGroup ).prefix( "/api" );
