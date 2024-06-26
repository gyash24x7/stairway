import { TrpcService } from "@common/core";
import {
	askCardInputSchema,
	type AskMove,
	type CallMove,
	callSetInputSchema,
	type CardLocationsData,
	type CardsData,
	createGameInputSchema,
	createTeamsInputSchema,
	type Game,
	type GameData,
	gameIdInputSchema,
	joinGameInputSchema,
	type PlayerData,
	type TeamData,
	type TransferMove,
	transferTurnInputSchema
} from "@literature/data";
import { Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
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
} from "../commands";
import { CardLocationsDataQuery, CardsDataQuery } from "../queries";
import { MiddlewareService } from "./middleware.service";

@Injectable()
export class RouterService {

	constructor(
		private readonly trpc: TrpcService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus,
		private readonly middlewares: MiddlewareService
	) {}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.procedure
				.input( createGameInputSchema )
				.mutation( ( { input, ctx: { authUser } } ) => {
					const command = new CreateGameCommand( input, authUser );
					return this.commandBus.execute<CreateGameCommand, GameData>( command );
				} ),

			joinGame: this.trpc.procedure
				.input( joinGameInputSchema )
				.mutation( ( { input, ctx: { authUser } } ) => {
					const command = new JoinGameCommand( input, authUser );
					return this.commandBus.execute<JoinGameCommand, Game>( command );
				} ),

			getGameData: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.query( async ( { ctx: { gameData, authUser } } ) => {
					const cardsDataQuery = new CardsDataQuery( gameData.id, authUser.id );
					const cardsData: CardsData = await this.queryBus.execute( cardsDataQuery );

					const cardLocationsDataQuery = new CardLocationsDataQuery( gameData.id, authUser.id );
					const cardLocationsData: CardLocationsData = await this.queryBus.execute( cardLocationsDataQuery );

					return { gameData, cardsData, cardLocationsData };
				} ),

			addBots: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new AddBotsCommand( gameData );
					return this.commandBus.execute<AddBotsCommand, PlayerData>( command );
				} ),

			createTeams: this.trpc.procedure
				.input( createTeamsInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "PLAYERS_READY" } ) )
				.mutation( ( { input, ctx: { gameData } } ) => {
					const command = new CreateTeamsCommand( input, gameData );
					return this.commandBus.execute<CreateTeamsCommand, TeamData>( command );
				} ),

			startGame: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "TEAMS_CREATED" } ) )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new StartGameCommand( gameData );
					return this.commandBus.execute<StartGameCommand, GameData>( command );
				} ),

			askCard: this.trpc.procedure
				.input( askCardInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx: { gameData, authUser } } ) => {
					const command = new AskCardCommand( input, gameData, authUser.id );
					return this.commandBus.execute<AskCardCommand, AskMove>( command );
				} ),

			callSet: this.trpc.procedure
				.input( callSetInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx: { gameData, authUser } } ) => {
					const command = new CallSetCommand( input, gameData, authUser.id );
					return this.commandBus.execute<CallSetCommand, CallMove>( command );
				} ),

			transferTurn: this.trpc.procedure
				.input( transferTurnInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx: { gameData, authUser } } ) => {
					const command = new TransferTurnCommand( input, gameData, authUser.id );
					return this.commandBus.execute<TransferTurnCommand, TransferMove>( command );
				} ),

			executeBotMove: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "IN_PROGRESS" } ) )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new ExecuteBotMoveCommand( gameData, gameData.currentTurn );
					return this.commandBus.execute<ExecuteBotMoveCommand, AskMove>( command );
				} )
		} );
	}
}