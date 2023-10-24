import { Body, Controller, Get, HttpCode, Post, Put } from "@nestjs/common";
import type {
	AskCardInput,
	AskMove,
	CallMove,
	CallSetInput,
	CardMappingData,
	CreateGameInput,
	CreateTeamsInput,
	Game,
	GameData,
	GameWithPlayers,
	JoinGameInput,
	PlayerSpecificData,
	TeamData,
	TransferChanceInput,
	TransferMove
} from "@literature/types";
import { GameStatus } from "@literature/types";
import { AuthInfo, RequiresAuth } from "@auth/core";
import { CardMappings, GameInfo, PlayerInfo, RequiresGame } from "../decorators";
import type { UserAuthInfo } from "@auth/types";
import { Paths } from "../constants";
import { CommandBus } from "@nestjs/cqrs";
import {
	AskCardCommand,
	CallSetCommand,
	CreateGameCommand,
	CreateTeamsCommand,
	JoinGameCommand,
	StartGameCommand,
	TransferChanceCommand
} from "../commands";
import { LoggerFactory } from "@s2h/core";

@RequiresAuth()
@Controller( Paths.BASE )
export class GamesController {

	private readonly logger = LoggerFactory.getLogger( GamesController );

	constructor( private readonly commandBus: CommandBus ) {}

	@Post()
	async createGame(
		@Body() input: CreateGameInput,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<Game> {
		this.logger.debug( ">> createGame()" );
		const game: Game = await this.commandBus.execute( new CreateGameCommand( input, authInfo ) );
		this.logger.debug( "<< createGame()" );
		return game;
	}

	@Post( Paths.JOIN_GAME )
	async joinGame(
		@Body() input: JoinGameInput,
		@AuthInfo() authInfo: UserAuthInfo
	): Promise<GameWithPlayers> {
		this.logger.debug( ">> joinGame()" );
		const game: GameWithPlayers = await this.commandBus.execute( new JoinGameCommand( input, authInfo ) );
		this.logger.debug( "<< joinGame()" );
		return game;
	}

	@Put( Paths.CREATE_TEAMS )
	@RequiresGame( { status: GameStatus.PLAYERS_READY } )
	async createTeams(
		@Body() input: CreateTeamsInput,
		@GameInfo() gameData: GameData
	): Promise<TeamData> {
		this.logger.debug( ">> createTeams()" );
		const teamData: TeamData = await this.commandBus.execute( new CreateTeamsCommand( input, gameData ) );
		this.logger.debug( "<< createTeams()" );
		return teamData;
	}

	@Put( Paths.START_GAME )
	@RequiresGame( { status: GameStatus.TEAMS_CREATED } )
	@HttpCode( 204 )
	async startGame( @GameInfo() gameData: GameData ): Promise<void> {
		this.logger.debug( ">> startGame()" );
		await this.commandBus.execute( new StartGameCommand( gameData ) );
		this.logger.debug( "<< startGame()" );
	}

	@Put( Paths.ASK_CARD )
	@RequiresGame( { status: GameStatus.IN_PROGRESS, cardMappings: true, turn: true } )
	async askCard(
		@Body() input: AskCardInput,
		@GameInfo() gameData: GameData,
		@PlayerInfo() playerData: PlayerSpecificData,
		@CardMappings() cardMappings: CardMappingData
	): Promise<AskMove> {
		this.logger.debug( ">> askCard()" );
		const askMove: AskMove = await this.commandBus.execute(
			new AskCardCommand( input, gameData, playerData, cardMappings )
		);
		this.logger.debug( "<< askCard()" );
		return askMove;
	}

	@Put( Paths.CALL_SET )
	@RequiresGame( { status: GameStatus.IN_PROGRESS, cardMappings: true, turn: true } )
	async callSet(
		@Body() input: CallSetInput,
		@GameInfo() gameData: GameData,
		@PlayerInfo() playerData: PlayerSpecificData,
		@CardMappings() cardMappings: CardMappingData
	): Promise<CallMove> {
		this.logger.debug( ">> callSet()" );
		const callMove: CallMove = await this.commandBus.execute(
			new CallSetCommand( input, gameData, playerData, cardMappings )
		);
		this.logger.debug( "<< callSet()" );
		return callMove;
	}

	@Put( Paths.TRANSFER_CHANCE )
	@RequiresGame( { status: GameStatus.IN_PROGRESS, cardMappings: true, turn: true } )
	async transferChance(
		@Body() input: TransferChanceInput,
		@GameInfo() gameData: GameData,
		@PlayerInfo() playerData: PlayerSpecificData,
		@CardMappings() cardMappings: CardMappingData
	): Promise<TransferMove> {
		this.logger.debug( ">> transferChance()" );
		const transferMove: TransferMove = await this.commandBus.execute(
			new TransferChanceCommand( input, gameData, playerData, cardMappings )
		);
		this.logger.debug( "<< transferChance()" );
		return transferMove;
	}

	@Get( Paths.GET_GAME )
	@RequiresGame()
	async getGameData( @GameInfo() gameData: GameData ): Promise<GameData> {
		this.logger.debug( ">> getGame()" );
		return gameData;
	}

	@Get( Paths.GET_PLAYER )
	@RequiresGame()
	async getPlayerData( @PlayerInfo() playerData: PlayerSpecificData ): Promise<PlayerSpecificData> {
		this.logger.debug( ">> getPlayer()" );
		return playerData;
	}
}