import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { GameWithPlayers, JoinGameInput } from "@literature/types";
import type { UserAuthInfo } from "@auth/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Messages } from "../constants";
import { PlayerJoinedEvent } from "../events";

export class JoinGameCommand implements ICommand {
	constructor(
		public readonly input: JoinGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( JoinGameCommand )
export class JoinGameCommandHandler implements ICommandHandler<JoinGameCommand, GameWithPlayers> {

	private readonly logger = LoggerFactory.getLogger( JoinGameCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { input, authInfo }: JoinGameCommand ) {
		this.logger.debug( ">> executeJoinGameCommand()" );

		const { game, isUserAlreadyInGame } = await this.validate( { input, authInfo } );
		if ( isUserAlreadyInGame ) {
			return game;
		}

		const newPlayer = await this.prisma.literature.player.create( {
			data: {
				id: authInfo.id,
				name: authInfo.name,
				avatar: authInfo.avatar,
				gameId: game.id,
				inferences: {}
			}
		} );

		game.players.push( newPlayer );
		const isCapacityFull = game.playerCount === game.players.length;
		this.eventBus.publish( new PlayerJoinedEvent( game.id, newPlayer, isCapacityFull ) );
		this.logger.debug( "Published PlayerJoinedEvent!" );

		this.logger.debug( "<< executeJoinGameCommand()" );
		return game;
	}

	private async validate( { input, authInfo }: JoinGameCommand ) {
		this.logger.debug( ">> validateJoinGameCommand()" );

		const game = await this.prisma.literature.game.findUnique( {
			where: { code: input.code },
			include: { players: true }
		} );

		if ( !game ) {
			this.logger.error( Messages.GAME_NOT_FOUND );
			throw new NotFoundException( Messages.GAME_NOT_FOUND );
		}

		const isUserAlreadyInGame = !!game.players.find( player => player.id === authInfo.id );

		if ( isUserAlreadyInGame ) {
			this.logger.warn( "%s GameId: %s", Messages.USER_ALREADY_PART_OF_GAME, game.id );
			return { game, isUserAlreadyInGame };
		}

		if ( game.players.length >= game.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id );
			throw new BadRequestException( Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
		}

		this.logger.debug( "<< validateJoinGameCommand()" );
		return { game, isUserAlreadyInGame };
	}
}