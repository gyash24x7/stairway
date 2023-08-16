import { Body, Controller, Get, NotFoundException, Post, Put, UseGuards } from "@nestjs/common";
import { Log, LoggerFactory } from "@s2h/utils";
import {
	CallbreakDeal,
	CallbreakGame,
	CallbreakGameStatus,
	CallbreakHand,
	CallbreakPlayer,
	CreateGameInput,
	DeclareWinInput,
	JoinGameInput
} from "@callbreak/data";
import { AuthGuard, AuthInfo } from "@auth/core";
import { RequireActiveGameGuard, RequireDealGuard, RequireGameGuard, RequirePlayerGuard } from "../guards";
import { ActiveDeal, ActiveGame, ActivePlayer } from "../decorators";
import type { UserAuthInfo } from "@auth/data";
import { ObjectId } from "mongodb";
import { CallbreakService } from "../services";

@UseGuards( AuthGuard )
@Controller( "callbreak/games" )
export class GamesController {
	private readonly logger = LoggerFactory.getLogger( GamesController );

	constructor( private readonly callbreakService: CallbreakService ) {}

	@Post()
	@Log( GamesController )
	async createGame( @Body() input: CreateGameInput, @AuthInfo() authInfo: UserAuthInfo ): Promise<string> {
		const id = new ObjectId();
		const game = CallbreakGame.createNew( id.toHexString(), input.trumpSuit, authInfo );
		const player = CallbreakPlayer.createFromAuthInfo( authInfo );
		game.addPlayers( player );
		await this.callbreakService.saveGame( game );
		return id.toHexString();
	}


	@Post( "join" )
	@Log( GamesController )
	async joinGame( @Body() input: JoinGameInput, @AuthInfo() authInfo: UserAuthInfo ) {
		const game = await this.callbreakService.findGameByCode( input.code );

		if ( game.playerIds.length >= 4 ) {
			this.logger.error( "Game already has 4 players! GameId: %s", game.id );
			throw new NotFoundException();
		}

		if ( game.isUserAlreadyInGame( authInfo.id ) ) {
			this.logger.warn( "User is already part of Game! GameId: %s", game.id );
			return game;
		}

		game.addPlayers( CallbreakPlayer.createFromAuthInfo( authInfo ) );

		await this.callbreakService.saveGame( game );
		return game.id;
	}

	@Put( ":id/start" )
	@Log( GamesController )
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async startGame( @ActiveGame() currentGame: CallbreakGame ) {
		if ( currentGame!.status !== CallbreakGameStatus.DEAL_AWAITED ) {
			this.logger.error( "Game not in correct status! GameId: %s", currentGame.id );
			throw new NotFoundException();
		}

		currentGame.status = CallbreakGameStatus.IN_PROGRESS;

		const [ deal, hands ] = currentGame.createDeal( new ObjectId().toHexString() );
		await Promise.all(
			Object.keys( hands ).map( playerId => {
				const id = new ObjectId().toHexString();
				const hand = CallbreakHand.create( id, currentGame.id, deal.id, playerId, hands[ playerId ] );
				return this.callbreakService.saveHand( hand );
			} )
		);
		currentGame.status = CallbreakGameStatus.IN_PROGRESS;

		await this.callbreakService.saveDeal( deal );
		await this.callbreakService.saveGame( currentGame );
		return currentGame.id;
	}

	@Put( ":id/record-declaration" )
	@Log( GamesController )
	@UseGuards( RequireGameGuard, RequireActiveGameGuard, RequirePlayerGuard, RequireDealGuard )
	async recordDeclaration(
		@Body() input: DeclareWinInput,
		@ActiveGame() currentGame: CallbreakGame,
		@ActiveDeal() currentDeal: CallbreakDeal,
		@ActivePlayer() currentPlayer: CallbreakPlayer
	) {
		currentDeal.recordDeclaration( currentPlayer.id, input.winsDeclared );
		await this.callbreakService.saveDeal( currentDeal );
		return currentGame.id;
	}

	@Get( ":id" )
	@Log( GamesController )
	@UseGuards( AuthGuard, RequireGameGuard, RequirePlayerGuard )
	async getGame( @ActiveGame() currentGame: CallbreakGame ) {
		return currentGame;
	}
}