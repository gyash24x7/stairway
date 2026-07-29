// Server-only handler implementations for the game + health HttpApi groups.
//
// Each `*ApiLive` is built against the merged `StairwayAPI` (so the group is
// keyed by the root api id). Every handler is the same shape — resolve
// `gameId -> Durable Object stub`, call one stub RPC, `orDie` transport errors —
// factored into `forward`. Imported only by `./worker` (not `./api`/`./client`),
// so the browser client never sees this graph.

import { AuthHttpContext } from "@s2h/auth/context";
import { AuthService } from "@s2h/auth/service";
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

/**
 * Resolve a game's Durable Object stub by id and run one RPC against it, turning
 * RPC transport failures into defects (`orDie`). `call` receives the concrete,
 * fully-typed stub — the game-specific type safety is preserved; only the DO
 * binding's error/requirement channels are erased at this transport seam.
 */
const forward = <Stub, A, E, R1, R2, R3>(
	DO: Effect.Effect<{ getByName: ( id: GameId ) => Effect.Effect<Stub, unknown, R2> }, unknown, R1>,
	gameId: GameId,
	call: ( stub: Stub ) => Effect.Effect<A, E, R3>
): Effect.Effect<A, never, R1 | R2 | R3> =>
	DO.pipe(
		Effect.flatMap( ns => ns.getByName( gameId ) ),
		Effect.flatMap( call ),
		Effect.orDie
	);

/** A freshly-minted `{ id, code }` for a new game instance. */
const newGame = () => ( {
	id: GameId.make( generateId() ),
	code: GameCode.make( generateGameCode() )
} );

export const HealthApiLive = HttpApiBuilder.group( StairwayAPI, "health", ( handlers ) =>
	handlers.handle( "healthCheck", () => Effect.succeed( { healthy: true } ) ) );

export const AuthApiLive = HttpApiBuilder.group( StairwayAPI, "auth", ( handlers ) => handlers
	.handle( "me", () => Effect.map( AuthHttpContext, ( context ) => context.user ) )

	.handle( "checkIfUserExists", ( { payload } ) =>
		Effect.flatMap( AuthService, ( auth ) => auth.checkIfUserExists( payload.username ) ) )

	.handle( "getLoginOptions", ( { payload } ) =>
		Effect.flatMap( AuthService, ( auth ) => auth.getLoginOptions( payload.username ) ) )

	.handle( "verifyLogin", ( { payload } ) =>
		Effect.flatMap( AuthService, auth => auth.verifyLogin( payload ) ) )

	.handle( "getRegisterOptions", ( { payload } ) =>
		Effect.flatMap( AuthService, ( auth ) => auth.getRegisterOptions( payload ) ) )

	.handle( "verifyRegistration", ( { payload } ) =>
		Effect.flatMap( AuthService, ( auth ) => auth.verifyRegistration( payload ) ) )

	.handle( "logout", () => Effect.flatMap( AuthService, ( auth ) => auth.logout() ) ) );

export const WordleApiLive = HttpApiBuilder.group( StairwayAPI, "wordle", handlers => handlers
	.handle( "createGame", ( { payload } ) => {
		const { id, code } = newGame();
		return forward( WordleEngineDO, id, s => s.initialize( { id, code, config: payload } ) );
	} )
	// TODO: Get Id from DB using Code
	.handle( "join", ( { payload } ) =>
		forward( WordleEngineDO, GameId.make( payload.code ), s => s.join( payload.playerInfo ) ) )

	.handle( "getState", ( { params, payload } ) =>
		forward( WordleEngineDO, params.gameId, s => s.getState( payload ) ) )

	.handle( "getLog", ( { params, payload } ) =>
		forward( WordleEngineDO, params.gameId, s => s.getLog( payload ) ) )

	.handle( "addBots", ( { params } ) =>
		forward( WordleEngineDO, params.gameId, s => s.addBots() ) )

	.handle( "start", ( { params } ) =>
		forward( WordleEngineDO, params.gameId, s => s.start() ) )

	.handle( "undo", ( { params, payload } ) =>
		forward( WordleEngineDO, params.gameId, s => s.undo( payload ) ) )

	.handle( "redo", ( { params, payload } ) =>
		forward( WordleEngineDO, params.gameId, s => s.redo( payload ) ) )

	.handle( "guess", ( { params, payload } ) =>
		forward( WordleEngineDO, params.gameId, s => s.guess( payload ) ) ) );

export const TicTacToeApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"tic-tac-toe",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => {
			const { id, code } = newGame();
			return forward( TicTacToeEngineDO, id, s => s.initialize( { id, code, config: payload } ) );
		} )
		// TODO: Get Id from DB using Code
		.handle( "join", ( { payload } ) =>
			forward( TicTacToeEngineDO, GameId.make( payload.code ), s => s.join( payload.playerInfo ) ) )

		.handle( "getState", ( { params, payload } ) =>
			forward( TicTacToeEngineDO, params.gameId, s => s.getState( payload ) ) )

		.handle( "getLog", ( { params, payload } ) =>
			forward( TicTacToeEngineDO, params.gameId, s => s.getLog( payload ) ) )

		.handle( "addBots", ( { params } ) =>
			forward( TicTacToeEngineDO, params.gameId, s => s.addBots() ) )

		.handle( "start", ( { params } ) =>
			forward( TicTacToeEngineDO, params.gameId, s => s.start() ) )

		.handle( "undo", ( { params, payload } ) =>
			forward( TicTacToeEngineDO, params.gameId, s => s.undo( payload ) ) )

		.handle( "redo", ( { params, payload } ) =>
			forward( TicTacToeEngineDO, params.gameId, s => s.redo( payload ) ) )

		.handle( "place", ( { params, payload } ) =>
			forward( TicTacToeEngineDO, params.gameId, s => s.place( payload ) ) )
);

export const SplendorApiLive = HttpApiBuilder.group( StairwayAPI, "splendor", handlers => handlers
	.handle( "createGame", ( { payload } ) => {
		const { id, code } = newGame();
		return forward( SplendorEngineDO, id, s => s.initialize( { id, code, config: payload } ) );
	} )

	// TODO: Get Id from DB using Code
	.handle( "join", ( { payload } ) =>
		forward( SplendorEngineDO, GameId.make( payload.code ), s => s.join( payload.playerInfo ) ) )

	.handle( "getState", ( { params, payload } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.getState( payload ) ) )

	.handle( "getLog", ( { params, payload } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.getLog( payload ) ) )

	.handle( "addBots", ( { params } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.addBots() ) )

	.handle( "start", ( { params } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.start() ) )

	.handle( "undo", ( { params, payload } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.undo( payload ) ) )

	.handle( "redo", ( { params, payload } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.redo( payload ) ) )

	.handle( "pickTokens", ( { params, payload } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.pickTokens( payload ) ) )

	.handle( "reserveCard", ( { params, payload } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.reserveCard( payload ) ) )

	.handle( "purchaseCard", ( { params, payload } ) =>
		forward( SplendorEngineDO, params.gameId, s => s.purchaseCard( payload ) ) ) );

export const FishApiLive = HttpApiBuilder.group( StairwayAPI, "fish", handlers => handlers
	.handle( "createGame", ( { payload } ) => {
		const { id, code } = newGame();
		return forward( FishEngineDO, id, s => s.initialize( { id, code, config: payload } ) );
	} )

	// TODO: Get Id from DB using Code
	.handle( "join", ( { payload } ) =>
		forward( FishEngineDO, GameId.make( payload.code ), s => s.join( payload.playerInfo ) ) )

	.handle( "getState", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.getState( payload ) ) )

	.handle( "getLog", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.getLog( payload ) ) )

	.handle( "addBots", ( { params } ) =>
		forward( FishEngineDO, params.gameId, s => s.addBots() ) )

	.handle( "start", ( { params } ) =>
		forward( FishEngineDO, params.gameId, s => s.start() ) )

	.handle( "undo", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.undo( payload ) ) )

	.handle( "redo", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.redo( payload ) ) )

	.handle( "createTeams", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.createTeams( payload ) ) )

	.handle( "askCard", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.askCard( payload ) ) )

	.handle( "claimBook", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.claimBook( payload ) ) )

	.handle( "transferTurn", ( { params, payload } ) =>
		forward( FishEngineDO, params.gameId, s => s.transferTurn( payload ) ) )
);

export const CallbreakApiLive = HttpApiBuilder.group( StairwayAPI, "callbreak", handlers => handlers
	.handle( "createGame", ( { payload } ) => {
		const { id, code } = newGame();
		return forward( CallbreakEngineDO, id, s => s.initialize( { id, code, config: payload } ) );
	} )
	// TODO: Get Id from DB using Code
	.handle( "join", ( { payload } ) =>
		forward( CallbreakEngineDO, GameId.make( payload.code ), s => s.join( payload.playerInfo ) ) )

	.handle( "getState", ( { params, payload } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.getState( payload ) ) )

	.handle( "getLog", ( { params, payload } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.getLog( payload ) ) )

	.handle( "addBots", ( { params } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.addBots() ) )

	.handle( "start", ( { params } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.start() ) )

	.handle( "undo", ( { params, payload } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.undo( payload ) ) )

	.handle( "redo", ( { params, payload } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.redo( payload ) ) )

	.handle( "declareWins", ( { params, payload } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.declareWins( payload ) ) )

	.handle( "playCard", ( { params, payload } ) =>
		forward( CallbreakEngineDO, params.gameId, s => s.playCard( payload ) ) )
);

export const KingdominoApiLive = HttpApiBuilder.group(
	StairwayAPI,
	"kingdomino",
	handlers => handlers
		.handle( "createGame", ( { payload } ) => {
			const { id, code } = newGame();
			return forward( KingdominoEngineDO, id, s => s.initialize( { id, code, config: payload } ) );
		} )

		// TODO: Get Id from DB using Code
		.handle( "join", ( { payload: { code, playerInfo } } ) =>
			forward( KingdominoEngineDO, GameId.make( code ), s => s.join( playerInfo ) ) )

		.handle( "getState", ( { params, payload } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.getState( payload ) ) )

		.handle( "getLog", ( { params, payload } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.getLog( payload ) ) )

		.handle( "addBots", ( { params } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.addBots() ) )

		.handle( "start", ( { params } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.start() ) )

		.handle( "undo", ( { params, payload } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.undo( payload ) ) )

		.handle( "redo", ( { params, payload } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.redo( payload ) ) )

		.handle( "selectDomino", ( { params, payload } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.selectDomino( payload ) ) )

		.handle( "placeDomino", ( { params, payload } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.placeDomino( payload ) ) )

		.handle( "discardDomino", ( { params, payload } ) =>
			forward( KingdominoEngineDO, params.gameId, s => s.discardDomino( payload ) ) )
);
