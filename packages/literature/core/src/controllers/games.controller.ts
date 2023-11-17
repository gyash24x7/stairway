import type {
	AskCardInput,
	AskMove,
	CallMove,
	CallSetInput,
	CardsData,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	GameWithPlayers,
	JoinGameInput,
	PlayerData,
	PlayerSpecificData,
	TeamData,
	TransferMove,
	TransferTurnInput,
	User
} from "@literature/types";
import { GameStatus } from "@literature/types";
import { Body, Controller, Get, HttpCode, Post, Put } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { AuthUser, LoggerFactory, RequiresAuth } from "@s2h/core";
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
import { Paths } from "../constants";
import { CardsInfo, GameInfo, PlayerInfo, RequiresGame } from "../decorators";

@RequiresAuth()
@Controller( Paths.BASE )
export class GamesController {

	private readonly logger = LoggerFactory.getLogger( GamesController );

	constructor( private readonly commandBus: CommandBus ) {}

	@Post()
	async createGame(
		@Body() input: CreateGameInput,
		@AuthUser() authUser: User
	): Promise<GameData> {
		this.logger.debug( ">> createGame()" );
		const game: GameData = await this.commandBus.execute( new CreateGameCommand( input, authUser ) );
		this.logger.debug( "<< createGame()" );
		return game;
	}

	@Post( Paths.JOIN_GAME )
	async joinGame(
		@Body() input: JoinGameInput,
		@AuthUser() authUser: User
	): Promise<GameWithPlayers> {
		this.logger.debug( ">> joinGame()" );
		const game: GameWithPlayers = await this.commandBus.execute( new JoinGameCommand( input, authUser ) );
		this.logger.debug( "<< joinGame()" );
		return game;
	}

	@Put( Paths.ADD_BOTS )
	@RequiresGame( { status: GameStatus.CREATED } )
	async addBots( @GameInfo() gameData: GameData ): Promise<PlayerData> {
		this.logger.debug( ">> addBots()" );
		const botData: PlayerData = await this.commandBus.execute( new AddBotsCommand( gameData ) );
		this.logger.debug( "<< addBots()" );
		return botData;
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
	@RequiresGame( { status: GameStatus.IN_PROGRESS, cards: true, turn: true } )
	async askCard(
		@Body() input: AskCardInput,
		@GameInfo() gameData: GameData,
		@PlayerInfo() playerData: PlayerSpecificData,
		@CardsInfo() cardsData: CardsData
	): Promise<AskMove> {
		this.logger.debug( ">> askCard()" );
		const askMove: AskMove = await this.commandBus.execute(
			new AskCardCommand( input, gameData, playerData, cardsData )
		);
		this.logger.debug( "<< askCard()" );
		return askMove;
	}

	@Put( Paths.CALL_SET )
	@RequiresGame( { status: GameStatus.IN_PROGRESS, cards: true, turn: true } )
	async callSet(
		@Body() input: CallSetInput,
		@GameInfo() gameData: GameData,
		@PlayerInfo() playerData: PlayerSpecificData,
		@CardsInfo() cardsData: CardsData
	): Promise<CallMove> {
		this.logger.debug( ">> callSet()" );
		const callMove: CallMove = await this.commandBus.execute(
			new CallSetCommand( input, gameData, playerData, cardsData )
		);
		this.logger.debug( "<< callSet()" );
		return callMove;
	}

	@Put( Paths.TRANSFER_TURN )
	@RequiresGame( { status: GameStatus.IN_PROGRESS, cards: true, turn: true } )
	async transferTurn(
		@Body() input: TransferTurnInput,
		@GameInfo() gameData: GameData,
		@PlayerInfo() playerData: PlayerSpecificData,
		@CardsInfo() cardsData: CardsData
	): Promise<TransferMove> {
		this.logger.debug( ">> transferTurn()" );
		const transferMove: TransferMove = await this.commandBus.execute(
			new TransferTurnCommand( input, gameData, playerData, cardsData )
		);
		this.logger.debug( "<< transferTurn()" );
		return transferMove;
	}

	@Get( Paths.GET_GAME )
	@RequiresGame()
	async getGameData(
		@GameInfo() gameData: GameData,
		@PlayerInfo() playerData: PlayerSpecificData
	): Promise<{ gameData: GameData, playerData: PlayerSpecificData }> {
		this.logger.debug( ">> getGameData()" );
		return { gameData, playerData };
	}
}