import { ApiRouter } from "@common/core";
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
import { GameStatus } from "@literature/types";
import type { NextFunction, Request, Response } from "express";
import { Constants, Paths } from "./literature.constants";
import type { LiteratureMiddleware } from "./literature.middleware";
import { literatureMiddleware } from "./literature.middleware";
import type { LiteratureService } from "./literature.service";
import { literatureService } from "./literature.service";

export type LiteratureContext<I = undefined> = {
	input: I;
	authUser: User;
	gameData?: GameData;
	playerData?: PlayerSpecificData;
	cardsData?: CardsData;
}

export class LiteratureRouter extends ApiRouter {

	constructor(
		private readonly literatureMiddleware: LiteratureMiddleware,
		private readonly literatureService: LiteratureService
	) {
		super();
	}

	registerRoutes() {
		this.router.post(
			Paths.CREATE_GAME,
			async ( req, res ) => {
				const { input, authUser } = this.getContext<CreateGameInput>( req, res );
				const responseBody = await this.literatureService.createGame( input, authUser );
				res.send( responseBody );
			}
		);

		this.router.post(
			Paths.JOIN_GAME,
			async ( req, res ) => {
				const { input, authUser } = this.getContext<JoinGameInput>( req, res );
				const responseBody = await this.literatureService.joinGame( input, authUser );
				res.send( responseBody );
			}
		);

		this.router.get(
			Paths.GET_GAME,
			( req: Request, res: Response, next: NextFunction ) => this.literatureMiddleware.use( req, res, next ),
			async ( req, res ) => {
				const { gameData, playerData } = this.getContext( req, res );
				res.send( { gameData, playerData } );
			}
		);

		this.router.put(
			Paths.ADD_BOTS,
			async ( req: Request, res: Response, next: NextFunction ) => {
				res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: GameStatus.CREATED };
				await this.literatureMiddleware.use( req, res, next );
			},
			async ( req, res ) => {
				const { gameData } = this.getContext( req, res );
				const responseBody = await this.literatureService.addBots( gameData! );
				res.send( responseBody );
			}
		);

		this.router.put(
			Paths.CREATE_TEAMS,
			async ( req: Request, res: Response, next: NextFunction ) => {
				res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: GameStatus.PLAYERS_READY };
				await this.literatureMiddleware.use( req, res, next );
			},
			async ( req, res ) => {
				const { input, gameData } = this.getContext<CreateTeamsInput>( req, res );
				const responseBody = await this.literatureService.createTeams( input, gameData! );
				res.send( responseBody );
			}
		);

		this.router.put(
			Paths.START_GAME,
			async ( req: Request, res: Response, next: NextFunction ) => {
				res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: GameStatus.TEAMS_CREATED };
				await this.literatureMiddleware.use( req, res, next );
			},
			async ( req, res ) => {
				const { gameData } = this.getContext( req, res );
				const responseBody = await this.literatureService.startGame( gameData! );
				res.send( responseBody );
			}
		);

		this.router.put(
			Paths.ASK_CARD,
			async ( req: Request, res: Response, next: NextFunction ) => {
				res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: GameStatus.IN_PROGRESS, turn: true };
				await this.literatureMiddleware.use( req, res, next );
			},
			async ( req, res ) => {
				const { input, playerData, gameData } = this.getContext<AskCardInput>( req, res );
				const responseBody = await this.literatureService.askCard( input, gameData!, playerData! );
				res.send( responseBody );
			}
		);

		this.router.put(
			Paths.CALL_SET,
			async ( req: Request, res: Response, next: NextFunction ) => {
				res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: GameStatus.IN_PROGRESS, turn: true };
				await this.literatureMiddleware.use( req, res, next );
			},
			async ( req, res ) => {
				const { input, playerData, gameData } = this.getContext<CallSetInput>( req, res );
				const responseBody = await this.literatureService.callSet( input, gameData!, playerData! );
				res.send( responseBody );
			}
		);

		this.router.put(
			Paths.TRANSFER_TURN,
			async ( req: Request, res: Response, next: NextFunction ) => {
				res.locals[ Constants.REQUIRED_GAME_DATA ] = { status: GameStatus.IN_PROGRESS, turn: true };
				await this.literatureMiddleware.use( req, res, next );
			},
			async ( req, res ) => {
				const { input, playerData, gameData } = this.getContext<TransferTurnInput>( req, res );
				const responseBody = await this.literatureService.transferTurn( input, gameData!, playerData! );
				res.send( responseBody );
			}
		);

		return this.router;
	}

	private getContext<I = undefined>( req: Request, res: Response ): LiteratureContext<I> {
		const input = req.body ?? undefined;
		const authUser = res.locals[ Constants.AUTH_USER ];
		const gameData = res.locals[ Constants.GAME_DATA ];
		const playerData = res.locals[ Constants.PLAYER_DATA ];
		const cardsData = res.locals[ Constants.CARDS_DATA ];

		return { authUser, gameData, playerData, cardsData, input };
	}
}

export const literatureRouter = new LiteratureRouter( literatureMiddleware, literatureService );