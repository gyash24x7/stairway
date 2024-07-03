import { type AuthContext, LoggerFactory, type MiddlewareFn, TrpcService, type UserAuthInfo } from "@backend/utils";
import { Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	AddBotsCommand,
	AskCardCommand,
	CallSetCommand,
	CreateGameCommand,
	CreateTeamsCommand,
	ExecuteBotMoveCommand,
	JoinGameCommand,
	StartGameCommand,
	TransferTurnCommand
} from "./commands";
import { Messages } from "./literature.constants.ts";
import type {
	AskMove,
	CallMove,
	CardLocationsData,
	CardsData,
	Game,
	GameData,
	GameStatus,
	PlayerData,
	TeamData,
	TransferMove
} from "./literature.types.ts";
import { CardLocationsDataQuery, CardsDataQuery, GameDataQuery } from "./queries";

export type LiteratureContext = { gameData: GameData, authInfo: UserAuthInfo };
type RequiredGameData = { status?: GameStatus, turn?: true };

@Injectable()
export class LiteratureRouter {

	private readonly logger = LoggerFactory.getLogger( LiteratureRouter );

	constructor(
		private readonly trpc: TrpcService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {}

	createContext() {
		return this.trpc.createContextFn;
	}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.authenticatedProcedure
				.input( z.object( { playerCount: z.number().positive().multipleOf( 2 ).lte( 8 ) } ) )
				.mutation( ( { input, ctx: { authInfo } } ) => {
					const command = new CreateGameCommand( input, authInfo );
					return this.commandBus.execute<CreateGameCommand, GameData>( command );
				} ),

			joinGame: this.trpc.authenticatedProcedure
				.input( z.object( { code: z.string().length( 6 ) } ) )
				.mutation( ( { input, ctx: { authInfo } } ) => {
					const command = new JoinGameCommand( input, authInfo );
					return this.commandBus.execute<JoinGameCommand, Game>( command );
				} ),

			getGameData: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string() } ) )
				.use( this.gameDataMiddleware() )
				.query( async ( { ctx: { gameData, authInfo } } ) => {
					const cardsDataQuery = new CardsDataQuery( gameData.id, authInfo.id );
					const cardsData: CardsData = await this.queryBus.execute( cardsDataQuery );

					const cardLocationsDataQuery = new CardLocationsDataQuery( gameData.id, authInfo.id );
					const cardLocationsData: CardLocationsData = await this.queryBus.execute( cardLocationsDataQuery );

					return {
						gameData,
						hand: cardsData.hands[ authInfo.id ]?.serialize(),
						cardLocations: cardLocationsData[ authInfo.id ]
					};
				} ),

			addBots: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string() } ) )
				.use( this.gameDataMiddleware() )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new AddBotsCommand( gameData );
					return this.commandBus.execute<AddBotsCommand, PlayerData>( command );
				} ),

			createTeams: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string(), data: z.record( z.string().array() ) } ) )
				.use( this.gameDataMiddleware() )
				.use( this.validationMiddleware( { status: "PLAYERS_READY" } ) )
				.mutation( ( { input, ctx: { gameData } } ) => {
					const command = new CreateTeamsCommand( input, gameData );
					return this.commandBus.execute<CreateTeamsCommand, TeamData>( command );
				} ),

			startGame: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string() } ) )
				.use( this.gameDataMiddleware() )
				.use( this.validationMiddleware( { status: "TEAMS_CREATED" } ) )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new StartGameCommand( gameData );
					return this.commandBus.execute<StartGameCommand, GameData>( command );
				} ),

			askCard: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string(), from: z.string(), for: z.string() } ) )
				.use( this.gameDataMiddleware() )
				.use( this.validationMiddleware( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx: { gameData, authInfo } } ) => {
					const command = new AskCardCommand( input, gameData, authInfo.id );
					return this.commandBus.execute<AskCardCommand, AskMove>( command );
				} ),

			callSet: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string(), data: z.record( z.string(), z.string() ) } ) )
				.use( this.gameDataMiddleware() )
				.use( this.validationMiddleware( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx: { gameData, authInfo } } ) => {
					const command = new CallSetCommand( input, gameData, authInfo.id );
					return this.commandBus.execute<CallSetCommand, CallMove>( command );
				} ),

			transferTurn: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string(), transferTo: z.string() } ) )
				.use( this.gameDataMiddleware() )
				.use( this.validationMiddleware( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx: { gameData, authInfo } } ) => {
					const command = new TransferTurnCommand( input, gameData, authInfo.id );
					return this.commandBus.execute<TransferTurnCommand, TransferMove>( command );
				} ),

			executeBotMove: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string() } ) )
				.use( this.gameDataMiddleware() )
				.use( this.validationMiddleware( { status: "IN_PROGRESS" } ) )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new ExecuteBotMoveCommand( gameData, gameData.currentTurn );
					return this.commandBus.execute<ExecuteBotMoveCommand, AskMove>( command );
				} )
		} );
	}

	gameDataMiddleware(): MiddlewareFn<AuthContext, LiteratureContext> {
		return async opts => {
			const { authInfo } = opts.ctx;
			if ( !authInfo ) {
				this.logger.error( "Unauthorized!" );
				throw new TRPCError( { code: "UNAUTHORIZED" } );
			}

			const { gameId } = await opts.getRawInput() as { gameId: string };
			const gameDataQuery = new GameDataQuery( gameId );
			const gameData: GameData | undefined = await this.queryBus.execute( gameDataQuery );

			if ( !gameData ) {
				this.logger.error( "Game Not Found! UserId: %s, GameId: %s", authInfo.id, gameId );
				throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
			}

			if ( !gameData.players[ authInfo.id ] ) {
				this.logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
				throw new TRPCError( { code: "FORBIDDEN", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}

			return opts.next( { ctx: { authInfo, gameData } } );
		};
	}

	validationMiddleware( data: RequiredGameData ): MiddlewareFn<LiteratureContext, LiteratureContext> {
		return async ( { ctx, next } ) => {
			if ( !!data.status && ctx.gameData.status !== data.status ) {
				this.logger.error( "Game Status is not %s! GameId: %s", data.status, ctx.gameData.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INCORRECT_STATUS } );
			}

			if ( !!data.turn && ctx.gameData.currentTurn !== ctx.authInfo.id ) {
				this.logger.error( "It's not your turn! GameId: %s", ctx.gameData.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_OUT_OF_TURN } );
			}

			return next( { ctx } );
		};
	}
}