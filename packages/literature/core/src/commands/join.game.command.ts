import { LoggerFactory, type User } from "@common/core";
import type { Game, JoinGameInput } from "@literature/data";
import { CommandHandler, EventBus, ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { PlayerJoinedEvent } from "../events";
import { DatabaseService } from "../services";
import { Messages } from "../utils";

export class JoinGameCommand implements ICommand {
	constructor(
		public readonly input: JoinGameInput,
		public readonly authUser: User
	) {}
}

@CommandHandler( JoinGameCommand )
export class JoinGameCommandHandler implements ICommandHandler<JoinGameCommand, Game> {

	private readonly logger = LoggerFactory.getLogger( JoinGameCommandHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: JoinGameCommand ): Promise<Game> {
		this.logger.debug( ">> joinGame()" );

		const { game, isUserAlreadyInGame } = await this.validate( command );
		if ( isUserAlreadyInGame ) {
			return game;
		}

		const { authUser } = command;
		const newPlayer = await this.db.createPlayer( {
			id: authUser.id,
			name: authUser.name,
			gameId: game.id
		} );

		const isCapacityFull = game.playerCount === game.players.length + 1;
		this.eventBus.publish( new PlayerJoinedEvent( newPlayer, isCapacityFull ) );

		this.logger.debug( "<< joinGame()" );
		return game;
	}

	async validate( { input, authUser }: JoinGameCommand ) {
		this.logger.debug( ">> validateJoinGameRequest()" );

		const game = await this.db.getGameByCode( input.code );

		if ( !game ) {
			this.logger.error( Messages.GAME_NOT_FOUND );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		this.logger.debug( "Found Game: %o", game.players.length );

		const isUserAlreadyInGame = !!game.players.find( player => player.id === authUser.id );

		if ( isUserAlreadyInGame ) {
			this.logger.warn( "%s GameId: %s", Messages.USER_ALREADY_PART_OF_GAME, game.id );
			return { game, isUserAlreadyInGame };
		}

		if ( game.players.length >= game.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS } );
		}

		this.logger.debug( "<< validateJoinGameRequest()" );
		return { game, isUserAlreadyInGame };
	}

}