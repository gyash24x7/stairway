import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import type {
	AggregatedGameData,
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	GameIdResponse,
	JoinGameInput,
	PlayerSpecificGameData,
	TransferChanceInput
} from "@literature/data";
import { GameStatus } from "@literature/data";
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
import { PlayerSpecificGameQuery } from "../queries";
import { LoggerFactory } from "@s2h/core";
import type { ApiResponse } from "@s2h/client";

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
	): Promise<GameIdResponse> {
		this.logger.debug( ">> createGame()" );
		const id: string = await this.commandBus.execute( new CreateGameCommand( input, authInfo ) );
		return { id };
	}

	@Post( Paths.JOIN_GAME )
	async joinGame(
		@Body() input: JoinGameInput,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<GameIdResponse> {
		this.logger.debug( ">> joinGame()" );
		const id: string = await this.commandBus.execute( new JoinGameCommand( input, authInfo ) );
		return { id };
	}

	@Put( Paths.CREATE_TEAMS )
	@RequiresStatus( GameStatus.PLAYERS_READY )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard )
	async createTeams(
		@Body() input: CreateTeamsInput,
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<ApiResponse> {
		this.logger.debug( ">> createTeams()" );
		await this.commandBus.execute( new CreateTeamsCommand( input, currentGame, authInfo ) );
		return { success: true };
	}

	@Put( Paths.START_GAME )
	@RequiresStatus( GameStatus.TEAMS_CREATED )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard )
	async startGame(
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<ApiResponse> {
		this.logger.debug( ">> startGame()" );
		await this.commandBus.execute( new StartGameCommand( currentGame, authInfo ) );
		return { success: true };
	}

	@Put( Paths.ASK_CARD )
	@RequiresStatus( GameStatus.IN_PROGRESS )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard, RequireTurnGuard )
	async askCard(
		@Body() input: AskCardInput,
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<ApiResponse> {
		this.logger.debug( ">> askCard()" );
		await this.commandBus.execute( new AskCardCommand( input, currentGame, authInfo ) );
		return { success: true };
	}

	@Put( Paths.CALL_SET )
	@RequiresStatus( GameStatus.IN_PROGRESS )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard, RequireTurnGuard )
	async callSet(
		@Body() input: CallSetInput,
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<ApiResponse> {
		this.logger.debug( ">> callSet()" );
		await this.commandBus.execute( new CallSetCommand( input, currentGame, authInfo ) );
		return { success: true };
	}

	@Put( Paths.TRANSFER_CHANCE )
	@RequiresStatus( GameStatus.IN_PROGRESS )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireGameStatusGuard, RequireTurnGuard )
	async transferChance(
		@Body() input: TransferChanceInput,
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<ApiResponse> {
		this.logger.debug( ">> transferChance()" );
		await this.commandBus.execute( new TransferChanceCommand( input, currentGame, authInfo ) );
		return { success: true };
	}

	@Get( Paths.GET_GAME )
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async getGameForPlayer(
		@ActiveGame() currentGame: AggregatedGameData,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<PlayerSpecificGameData> {
		this.logger.debug( ">> getGame()" );
		return this.queryBus.execute( new PlayerSpecificGameQuery( currentGame, authInfo.id ) );
	}
}