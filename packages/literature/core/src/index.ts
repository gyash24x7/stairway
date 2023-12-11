import type { RealtimeService } from "@common/core";
import { createLiteratureDrizzleClient, LiteratureRepository, type PostgresClient } from "@common/data";
import type {
	AskCardInput,
	CallSetInput,
	CardsData,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	JoinGameInput,
	PlayerSpecificData,
	TransferTurnInput,
	User
} from "@literature/types";
import type { NextFunction, Request, Response, Router } from "express";
import { Constants, Paths } from "./literature.constants";
import { LiteratureMiddleware } from "./literature.middleware";
import { LiteratureService } from "./literature.service";
import { LiteratureTransformers } from "./literature.transformers";
import { LiteratureValidators } from "./literature.validators";

type LiteratureContext<I = undefined> = {
	input: I;
	authUser: User;
	gameData?: GameData;
	playerData?: PlayerSpecificData;
	cardsData?: CardsData;
}

export function initializeLiteratureModule(
	dbClient: PostgresClient,
	realtimeService: RealtimeService,
	router: Router
) {
	const drizzleClient = createLiteratureDrizzleClient( dbClient );
	const repository = new LiteratureRepository( drizzleClient );
	const validators = new LiteratureValidators( repository );
	const transformers = new LiteratureTransformers();
	const service = new LiteratureService( repository, realtimeService, validators, transformers );
	const middleware = new LiteratureMiddleware( service );

	router.post(
		Paths.CREATE_GAME,
		async ( req, res ) => {
			const { input, authUser } = getContext<CreateGameInput>( req, res );
			const responseBody = await service.createGame( input, authUser );
			res.send( responseBody );
		}
	);

	router.post(
		Paths.JOIN_GAME,
		async ( req, res ) => {
			const { input, authUser } = getContext<JoinGameInput>( req, res );
			const responseBody = await service.joinGame( input, authUser );
			res.send( responseBody );
		}
	);

	router.get(
		Paths.GET_GAME,
		( req: Request, res: Response, next: NextFunction ) => middleware.use( req, res, next ),
		async ( req, res ) => {
			const { gameData, playerData } = getContext( req, res );
			res.send( { gameData, playerData } );
		}
	);

	router.put(
		Paths.ADD_BOTS,
		async ( req: Request, res: Response, next: NextFunction ) => {
			res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: "CREATED" };
			await middleware.use( req, res, next );
		},
		async ( req, res ) => {
			const { gameData } = getContext( req, res );
			const responseBody = await service.addBots( gameData! );
			res.send( responseBody );
		}
	);

	router.put(
		Paths.CREATE_TEAMS,
		async ( req: Request, res: Response, next: NextFunction ) => {
			res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: "PLAYERS_READY" };
			await middleware.use( req, res, next );
		},
		async ( req, res ) => {
			const { input, gameData } = getContext<CreateTeamsInput>( req, res );
			const responseBody = await service.createTeams( input, gameData! );
			res.send( responseBody );
		}
	);

	router.put(
		Paths.START_GAME,
		async ( req: Request, res: Response, next: NextFunction ) => {
			res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: "TEAMS_CREATED" };
			await middleware.use( req, res, next );
		},
		async ( req, res ) => {
			const { gameData } = getContext( req, res );
			const responseBody = await service.startGame( gameData! );
			res.send( responseBody );
		}
	);

	router.put(
		Paths.ASK_CARD,
		async ( req: Request, res: Response, next: NextFunction ) => {
			res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: "IN_PROGRESS", turn: true };
			await middleware.use( req, res, next );
		},
		async ( req, res ) => {
			const { input, playerData, gameData } = getContext<AskCardInput>( req, res );
			const responseBody = await service.askCard( input, gameData!, playerData! );
			res.send( responseBody );
		}
	);

	router.put(
		Paths.CALL_SET,
		async ( req: Request, res: Response, next: NextFunction ) => {
			res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: "IN_PROGRESS", turn: true };
			await middleware.use( req, res, next );
		},
		async ( req, res ) => {
			const { input, playerData, gameData } = getContext<CallSetInput>( req, res );
			const responseBody = await service.callSet( input, gameData!, playerData! );
			res.send( responseBody );
		}
	);

	router.put(
		Paths.TRANSFER_TURN,
		async ( req: Request, res: Response, next: NextFunction ) => {
			res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: "IN_PROGRESS", turn: true };
			await middleware.use( req, res, next );
		},
		async ( req, res ) => {
			const { input, playerData, gameData } = getContext<TransferTurnInput>( req, res );
			const responseBody = await service.transferTurn( input, gameData!, playerData! );
			res.send( responseBody );
		}
	);
}

function getContext<I = undefined>( req: Request, res: Response ): LiteratureContext<I> {
	const input = req.body ?? undefined;
	const authUser = res.locals[ Constants.AUTH_USER ];
	const gameData = res.locals[ Constants.GAME_DATA ];
	const playerData = res.locals[ Constants.PLAYER_DATA ];
	const cardsData = res.locals[ Constants.CARDS_DATA ];

	return { authUser, gameData, playerData, cardsData, input };
}