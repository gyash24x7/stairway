// Server-only handler implementations for the game + health HttpApi groups.
//
// Each `*ApiLive` is built against the merged `StairwayAPI` (so the group is
// keyed by the root api id) and resolves `gameId -> Durable Object stub` via the
// per-game `*EngineDO` from `./cloudflare`. Imported only by `./worker` — NOT by
// `./api`/`./client`, so the browser client never sees this graph.

import { GameCode, GameId } from "@s2h/swish/schema";
import { generateGameCode, generateId } from "@s2h/utils/generator";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { StairwayAPI } from "./api";
import {
	CallbreakEngineDO,
	FishEngineDO,
	KingdominoEngineDO,
	SplendorEngineDO,
	TicTacToeEngineDO,
	WordleEngineDO
} from "./cloudflare";

export const HealthApiLive = HttpApiBuilder.group( StairwayAPI, "health", ( handlers ) =>
	handlers.handle( "healthCheck", () => Effect.succeed( { healthy: true } ) ) );

export const WordleApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"wordle",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
			const gameId = GameId.make( generateId() );
			const code = GameCode.make( generateGameCode() );
			return yield* WordleEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.initialize( { id: gameId, code, config: payload } ) ),
				Effect.orDie
			);
		} ) )
		.handle( "join", ( { payload } ) => Effect.gen( function* () {
			// TODO: Get Id from DB using Code
			const gameId = GameId.make( payload.code );
			return yield* WordleEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.join( payload.playerInfo ) ),
				Effect.orDie
			);
		} ) )
		.handle( "getState", ( { params, payload } ) => WordleEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.getState( payload ) ),
			Effect.orDie
		) )
		.handle( "addBots", ( { params } ) => WordleEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.addBots() ),
			Effect.orDie
		) )
		.handle( "start", ( { params } ) => WordleEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.start() ),
			Effect.orDie
		) )
		.handle( "undo", ( { params, payload } ) => WordleEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.undo( payload ) ),
			Effect.orDie
		) )
		.handle( "redo", ( { params, payload } ) => WordleEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.redo( payload ) ),
			Effect.orDie
		) )
		.handle( "guess", ( { params, payload } ) => WordleEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.guess( payload ) ),
			Effect.orDie
		) )
);

export const TicTacToeApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"tic-tac-toe",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
			const gameId = GameId.make( generateId() );
			const code = GameCode.make( generateGameCode() );
			return yield* TicTacToeEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.initialize( { id: gameId, code, config: payload } ) ),
				Effect.orDie
			);
		} ) )
		.handle( "join", ( { payload } ) => Effect.gen( function* () {
			// TODO: Get Id from DB using Code
			const gameId = GameId.make( payload.code );
			return yield* TicTacToeEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.join( payload.playerInfo ) ),
				Effect.orDie
			);
		} ) )
		.handle( "getState", ( { params, payload } ) => TicTacToeEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.getState( payload ) ),
			Effect.orDie
		) )
		.handle( "addBots", ( { params } ) => TicTacToeEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.addBots() ),
			Effect.orDie
		) )
		.handle( "start", ( { params } ) => TicTacToeEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.start() ),
			Effect.orDie
		) )
		.handle( "undo", ( { params, payload } ) => TicTacToeEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.undo( payload ) ),
			Effect.orDie
		) )
		.handle( "redo", ( { params, payload } ) => TicTacToeEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.redo( payload ) ),
			Effect.orDie
		) )
		.handle( "place", ( { params, payload } ) => TicTacToeEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.place( payload ) ),
			Effect.orDie
		) )
);

export const SplendorApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"splendor",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
			const gameId = GameId.make( generateId() );
			const code = GameCode.make( generateGameCode() );
			return yield* SplendorEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.initialize( { id: gameId, code, config: payload } ) ),
				Effect.orDie
			);
		} ) )
		.handle( "join", ( { payload } ) => Effect.gen( function* () {
			// TODO: Get Id from DB using Code
			const gameId = GameId.make( payload.code );
			return yield* SplendorEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.join( payload.playerInfo ) ),
				Effect.orDie
			);
		} ) )
		.handle( "getState", ( { params, payload } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.getState( payload ) ),
			Effect.orDie
		) )
		.handle( "addBots", ( { params } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.addBots() ),
			Effect.orDie
		) )
		.handle( "start", ( { params } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.start() ),
			Effect.orDie
		) )
		.handle( "undo", ( { params, payload } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.undo( payload ) ),
			Effect.orDie
		) )
		.handle( "redo", ( { params, payload } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.redo( payload ) ),
			Effect.orDie
		) )
		.handle( "pickTokens", ( { params, payload } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.pickTokens( payload ) ),
			Effect.orDie
		) )
		.handle( "reserveCard", ( { params, payload } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.reserveCard( payload ) ),
			Effect.orDie
		) )
		.handle( "purchaseCard", ( { params, payload } ) => SplendorEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.purchaseCard( payload ) ),
			Effect.orDie
		) )
);

export const FishApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"fish",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
			const gameId = GameId.make( generateId() );
			const code = GameCode.make( generateGameCode() );
			return yield* FishEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.initialize( { id: gameId, code, config: payload } ) ),
				Effect.orDie
			);
		} ) )
		.handle( "join", ( { payload } ) => Effect.gen( function* () {
			// TODO: Get Id from DB using Code
			const gameId = GameId.make( payload.code );
			return yield* FishEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.join( payload.playerInfo ) ),
				Effect.orDie
			);
		} ) )
		.handle( "getState", ( { params, payload } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.getState( payload ) ),
			Effect.orDie
		) )
		.handle( "addBots", ( { params } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.addBots() ),
			Effect.orDie
		) )
		.handle( "start", ( { params } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.start() ),
			Effect.orDie
		) )
		.handle( "undo", ( { params, payload } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.undo( payload ) ),
			Effect.orDie
		) )
		.handle( "redo", ( { params, payload } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.redo( payload ) ),
			Effect.orDie
		) )
		.handle( "createTeams", ( { params, payload } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.createTeams( payload ) ),
			Effect.orDie
		) )
		.handle( "askCard", ( { params, payload } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.askCard( payload ) ),
			Effect.orDie
		) )
		.handle( "claimBook", ( { params, payload } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.claimBook( payload ) ),
			Effect.orDie
		) )
		.handle( "transferTurn", ( { params, payload } ) => FishEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.transferTurn( payload ) ),
			Effect.orDie
		) )
);

export const CallbreakApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"callbreak",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
			const gameId = GameId.make( generateId() );
			const code = GameCode.make( generateGameCode() );
			return yield* CallbreakEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.initialize( { id: gameId, code, config: payload } ) ),
				Effect.orDie
			);
		} ) )
		.handle( "join", ( { payload } ) => Effect.gen( function* () {
			// TODO: Get Id from DB using Code
			const gameId = GameId.make( payload.code );
			return yield* CallbreakEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.join( payload.playerInfo ) ),
				Effect.orDie
			);
		} ) )
		.handle( "getState", ( { params, payload } ) => CallbreakEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.getState( payload ) ),
			Effect.orDie
		) )
		.handle( "addBots", ( { params } ) => CallbreakEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.addBots() ),
			Effect.orDie
		) )
		.handle( "start", ( { params } ) => CallbreakEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.start() ),
			Effect.orDie
		) )
		.handle( "undo", ( { params, payload } ) => CallbreakEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.undo( payload ) ),
			Effect.orDie
		) )
		.handle( "redo", ( { params, payload } ) => CallbreakEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.redo( payload ) ),
			Effect.orDie
		) )
		.handle( "declareWins", ( { params, payload } ) => CallbreakEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.declareWins( payload ) ),
			Effect.orDie
		) )
		.handle( "playCard", ( { params, payload } ) => CallbreakEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.playCard( payload ) ),
			Effect.orDie
		) )
);

export const KingdominoApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"kingdomino",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
			const gameId = GameId.make( generateId() );
			const code = GameCode.make( generateGameCode() );
			return yield* KingdominoEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.initialize( { id: gameId, code, config: payload } ) ),
				Effect.orDie
			);
		} ) )
		.handle( "join", ( { payload } ) => Effect.gen( function* () {
			// TODO: Get Id from DB using Code
			const gameId = GameId.make( payload.code );
			return yield* KingdominoEngineDO.pipe(
				Effect.flatMap( DO => DO.getByName( gameId ) ),
				Effect.flatMap( stub => stub.join( payload.playerInfo ) ),
				Effect.orDie
			);
		} ) )
		.handle( "getState", ( { params, payload } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.getState( payload ) ),
			Effect.orDie
		) )
		.handle( "addBots", ( { params } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.addBots() ),
			Effect.orDie
		) )
		.handle( "start", ( { params } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.start() ),
			Effect.orDie
		) )
		.handle( "undo", ( { params, payload } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.undo( payload ) ),
			Effect.orDie
		) )
		.handle( "redo", ( { params, payload } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.redo( payload ) ),
			Effect.orDie
		) )
		.handle( "selectDomino", ( { params, payload } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.selectDomino( payload ) ),
			Effect.orDie
		) )
		.handle( "placeDomino", ( { params, payload } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.placeDomino( payload ) ),
			Effect.orDie
		) )
		.handle( "discardDomino", ( { params, payload } ) => KingdominoEngineDO.pipe(
			Effect.flatMap( DO => DO.getByName( params.gameId ) ),
			Effect.flatMap( stub => stub.discardDomino( payload ) ),
			Effect.orDie
		) )
);
