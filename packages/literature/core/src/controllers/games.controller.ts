import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import type {
	AggregatedGameData,
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	PlayerSpecificGameData,
	TransferChanceInput
} from "@literature/data";
import { AuthGuard, AuthInfo } from "@auth/core";
import { RequireGameGuard, RequireGameStatusGuard, RequirePlayerGuard, RequireTurnGuard } from "../guards";
import { ActiveGame, RequiresStatus } from "../decorators";
import type { UserAuthInfo } from "@auth/data";
import { Paths } from "../constants";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import {
	AskCardCommand,
	CallSetCommand,
	CreateGameCommand,
	CreateTeamsCommand,
	JoinGameCommand,
	StartGameCommand,
	TransferChanceCommand
} from "../commands";
import { AggregateGameQuery } from "../queries";
import { LoggerFactory } from "@s2h/core";
import { GameStatus } from "@literature/prisma";

@UseGuards( AuthGuard )
@Controller( Paths.BASE )
export class GamesController {

	private readonly logger = LoggerFactory.getLogger( GamesController );

	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	@Post()
	async createGame(
		@Body() input: CreateGameInput,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<string> {
		this.logger.debug( ">> createGame()" );
		return this.commandBus.execute( new CreateGameCommand( input, authInfo ) );
	}

	@Post( Paths.JOIN_GAME )
	async joinGame(
		@Body() input: JoinGameInput,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<string> {
		this.logger.debug( ">> joinGame()" );
		return this.commandBus.execute( new JoinGameCommand( input, authInfo ) );
	}

	@Put( Paths.CREATE_TEAMS )
	@RequiresStatus( GameStatus.PLAYERS_READY )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard )
	async createTeams(
		@Body() input: CreateTeamsInput,
		@ActiveGame() currentGame: AggregatedGameData
	): Promise<string> {
		this.logger.debug( ">> createTeams()" );
		return this.commandBus.execute( new CreateTeamsCommand( input, currentGame ) );
	}

	@Put( Paths.START_GAME )
	@RequiresStatus( GameStatus.TEAMS_CREATED )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard )
	async startGame( @ActiveGame() currentGame: AggregatedGameData ): Promise<string> {
		this.logger.debug( ">> startGame()" );
		return this.commandBus.execute( new StartGameCommand( currentGame ) );
	}

	@Put( Paths.ASK_CARD )
	@RequiresStatus( GameStatus.IN_PROGRESS )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard, RequireTurnGuard )
	async askCard(
		@Body() input: AskCardInput,
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<string> {
		this.logger.debug( ">> askCard()" );
		return this.commandBus.execute( new AskCardCommand( input, currentGame, authInfo ) );
	}

	@Put( Paths.CALL_SET )
	@RequiresStatus( GameStatus.IN_PROGRESS )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard, RequireTurnGuard )
	async callSet(
		@Body() input: CallSetInput,
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<string> {
		this.logger.debug( ">> callSet()" );
		return this.commandBus.execute( new CallSetCommand( input, currentGame, authInfo ) );
	}

	@Put( Paths.TRANSFER_CHANCE )
	@RequiresStatus( GameStatus.IN_PROGRESS )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard, RequireTurnGuard )
	async transferChance(
		@Body() input: TransferChanceInput,
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<string> {
		this.logger.debug( ">> transferChance()" );
		return this.commandBus.execute( new TransferChanceCommand( input, currentGame, authInfo ) );
	}

	@Get( Paths.GET_GAME )
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async getGameForPlayer(
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<PlayerSpecificGameData> {
		this.logger.debug( ">> getGame()" );
		return this.queryBus.execute( new AggregateGameQuery( currentGame, authInfo ) );
	}
}