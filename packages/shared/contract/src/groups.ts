import {
	CallbreakConfig,
	CallbreakSnapshot,
	DeclareWinsInput,
	PlayCardInput
} from "@s2h/schema/callbreak";
import {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishSnapshot,
	TransferTurnInput
} from "@s2h/schema/fish";
import {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoSnapshot,
	PlaceDominoInput,
	SelectDominoInput
} from "@s2h/schema/kingdomino";
import {
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorSnapshot
} from "@s2h/schema/splendor";
import { PlaceInput, TicTacToeConfig, TicTacToeSnapshot } from "@s2h/schema/tictactoe";
import { GuessInput, WordleConfig, WordleSnapshot } from "@s2h/schema/wordle";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@s2h/swish/api";
import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import { AuthMiddleware } from "./middleware.ts";


// --- Health Api Group ---------------------------------------

const HealthCheckEndpoint = HttpApiEndpoint.get( "healthCheck", "/check", {
	success: Schema.Struct( { healthy: Schema.Boolean } )
} );

export const HealthApiGroup = HttpApiGroup.make( "health" )
	.add( HealthCheckEndpoint )
	.prefix( "/health" );


// --- Auth Api Group ---------------------------------------

const AuthGetEndpoint = HttpApiEndpoint.get( "authGet", "/*" );
const AuthPostEndpoint = HttpApiEndpoint.post( "authPost", "/*" );

export const AuthApiGroup = HttpApiGroup.make( "auth" )
	.add( AuthGetEndpoint )
	.add( AuthPostEndpoint )
	.prefix( "/auth" );


// --- Wordle Api Group ---------------------------------------

export const WordleApiGroup = HttpApiGroup.make( "wordle" )
	.add(
		CreateGameApiEndpoint( WordleConfig ),
		GetStateApiEndpoint( WordleSnapshot ),
		MoveApiEndpoint( "guess", GuessInput )
	)
	.prefix( "/wordle" )
	.middleware( AuthMiddleware );


// --- TicTacToe Api Group ---------------------------------------

export const TicTacToeApiGroup = HttpApiGroup.make( "tictactoe" )
	.add(
		CreateGameApiEndpoint( TicTacToeConfig ),
		GetStateApiEndpoint( TicTacToeSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "place", PlaceInput )
	)
	.prefix( "/tictactoe" )
	.middleware( AuthMiddleware );


// --- Splendor Api Group ---------------------------------------

export const SplendorApiGroup = HttpApiGroup.make( "splendor" )
	.add(
		CreateGameApiEndpoint( SplendorConfig ),
		GetStateApiEndpoint( SplendorSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "pickTokens", PickTokensInput ),
		MoveApiEndpoint( "reserveCard", ReserveCardInput ),
		MoveApiEndpoint( "purchaseCard", PurchaseCardInput )
	)
	.prefix( "/splendor" )
	.middleware( AuthMiddleware );


// --- Kingdomino Api Group ---------------------------------------

export const KingdominoApiGroup = HttpApiGroup.make( "kingdomino" )
	.add(
		CreateGameApiEndpoint( KingdominoConfig ),
		GetStateApiEndpoint( KingdominoSnapshot ),
		JoinApiEndpoint(),
		MoveApiEndpoint( "selectDomino", SelectDominoInput ),
		MoveApiEndpoint( "placeDomino", PlaceDominoInput ),
		MoveApiEndpoint( "discardDomino", DiscardDominoInput )
	)
	.prefix( "/kingdomino" )
	.middleware( AuthMiddleware );


// --- Fish Api Group ---------------------------------------

export const FishApiGroup = HttpApiGroup.make( "fish" )
	.add(
		CreateGameApiEndpoint( FishConfig ),
		GetStateApiEndpoint( FishSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "createTeams", CreateTeamsInput ),
		MoveApiEndpoint( "askCard", AskCardInput ),
		MoveApiEndpoint( "claimBook", ClaimBookInput ),
		MoveApiEndpoint( "transferTurn", TransferTurnInput )
	)
	.prefix( "/fish" )
	.middleware( AuthMiddleware );


// --- Callbreak Api Group ---------------------------------------

export const CallbreakApiGroup = HttpApiGroup.make( "callbreak" )
	.add(
		CreateGameApiEndpoint( CallbreakConfig ),
		GetStateApiEndpoint( CallbreakSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "declareWins", DeclareWinsInput ),
		MoveApiEndpoint( "playCard", PlayCardInput )
	)
	.prefix( "/callbreak" )
	.middleware( AuthMiddleware );
