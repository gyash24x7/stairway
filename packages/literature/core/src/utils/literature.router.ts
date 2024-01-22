import { TrpcService } from "@common/core";
import {
	askCardInputSchema,
	callSetInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	transferTurnInputSchema
} from "@literature/data";
import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
	AddBotsCommand,
	AskCardCommand,
	CallSetCommand,
	CreateGameCommand,
	CreateTeamsCommand,
	JoinGameCommand,
	StartGameCommand,
	TransferTurnCommand
} from "../commands";
import { LiteratureMiddlewares } from "./literature.middlewares";

@Injectable()
export class LiteratureRouter {

	constructor(
		private readonly trpc: TrpcService,
		private readonly commandBus: CommandBus,
		private readonly middlewares: LiteratureMiddlewares
	) {}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.procedure
				.input( createGameInputSchema )
				.mutation( ( { input, ctx: { authUser } } ) => {
					const command = new CreateGameCommand( input, authUser );
					return this.commandBus.execute( command );
				} ),

			joinGame: this.trpc.procedure
				.input( joinGameInputSchema )
				.mutation( ( { input, ctx: { authUser } } ) => {
					const command = new JoinGameCommand( input, authUser );
					return this.commandBus.execute( command );
				} ),

			getGameData: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.query( ( { ctx: { gameData, playerSpecificData } } ) => {
					return { gameData, playerSpecificData };
				} ),

			addBots: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new AddBotsCommand( gameData );
					return this.commandBus.execute( command );
				} ),

			createTeams: this.trpc.procedure
				.input( createTeamsInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "PLAYERS_READY" } ) )
				.mutation( ( { input, ctx: { gameData } } ) => {
					const command = new CreateTeamsCommand( input, gameData! );
					return this.commandBus.execute( command );
				} ),

			startGame: this.trpc.procedure
				.input( gameIdInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "TEAMS_CREATED" } ) )
				.mutation( ( { ctx: { gameData } } ) => {
					const command = new StartGameCommand( gameData! );
					return this.commandBus.execute( command );
				} ),

			askCard: this.trpc.procedure
				.input( askCardInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "IN_PROGRESS", turn: true } ) )
				.use( this.middlewares.cardsData() )
				.mutation( ( { input, ctx: { gameData, playerSpecificData, cardsData } } ) => {
					const command = new AskCardCommand( input, gameData!, playerSpecificData!, cardsData! );
					return this.commandBus.execute( command );
				} ),

			callSet: this.trpc.procedure
				.input( callSetInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "IN_PROGRESS", turn: true } ) )
				.use( this.middlewares.cardsData() )
				.mutation( ( { input, ctx: { gameData, playerSpecificData, cardsData } } ) => {
					const command = new CallSetCommand( input, gameData, playerSpecificData, cardsData );
					return this.commandBus.execute( command );
				} ),

			transferTurn: this.trpc.procedure
				.input( transferTurnInputSchema )
				.use( this.middlewares.gameAndPlayerData() )
				.use( this.middlewares.validateStatusAndTurn( { status: "IN_PROGRESS", turn: true } ) )
				.use( this.middlewares.cardsData() )
				.mutation( ( { input, ctx: { gameData, playerSpecificData, cardsData } } ) => {
					const command = new TransferTurnCommand( input, gameData, playerSpecificData, cardsData );
					return this.commandBus.execute( command );
				} )
		} );
	}
}