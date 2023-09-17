import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	IAggregatedGameData,
	JoinGameInput,
	LiteratureGame,
	LiteraturePlayer,
	TransferChanceInput
} from "@literature/data";
import { AuthGuard, AuthInfo } from "@auth/core";
import { RequireActiveGameGuard, RequireGameGuard, RequireHandsGuard, RequirePlayerGuard } from "../guards";
import { ActiveGame, ActiveGameHands, ActivePlayer } from "../decorators";
import type { CardHand } from "@s2h/cards";
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
		const gameId = await this.commandBus.execute( new CreateGameCommand( input, authInfo ) );
		this.logger.debug( "<< createGame() %s", gameId );
		return gameId;
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
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async createTeams(
		@Body() input: CreateTeamsInput,
		@ActiveGame() currentGame: LiteratureGame
	): Promise<string> {
		this.logger.debug( ">> createTeams()" );
		return this.commandBus.execute( new CreateTeamsCommand( input, currentGame ) );
	}

	@Put( Paths.START_GAME )
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async startGame( @ActiveGame() currentGame: LiteratureGame ): Promise<string> {
		this.logger.debug( ">> startGame()" );
		return this.commandBus.execute( new StartGameCommand( currentGame ) );
	}

	@Put( Paths.ASK_CARD )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async askCard(
		@Body() input: AskCardInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() currentPlayer: LiteraturePlayer,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>
	): Promise<string> {
		this.logger.debug( ">> askCard()" );
		return this.commandBus.execute( new AskCardCommand( input, currentGame, currentPlayer, currentGameHands ) );
	}

	@Put( Paths.CALL_SET )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async callSet(
		@Body() input: CallSetInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() currentPlayer: LiteraturePlayer,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>
	): Promise<string> {
		this.logger.debug( ">> callSet()" );
		return this.commandBus.execute( new CallSetCommand( input, currentGame, currentPlayer, currentGameHands ) );
	}

	@Put( Paths.TRANSFER_CHANCE )
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async transferChance(
		@Body() input: TransferChanceInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() currentPlayer: LiteraturePlayer,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>
	): Promise<string> {
		this.logger.debug( ">> transferChance()" );
		return this.commandBus.execute(
			new TransferChanceCommand( input, currentGame, currentPlayer, currentGameHands )
		);
	}

	@Get( Paths.GET_GAME )
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async getGame(
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() currentPlayer: LiteraturePlayer
	): Promise<IAggregatedGameData> {
		this.logger.debug( ">> getGame()" );
		return this.queryBus.execute( new AggregateGameQuery( currentGame, currentPlayer ) );
	}
}