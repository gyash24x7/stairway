import type { GameWithPlayers, JoinGameInput, User } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { PlayerJoinedEvent } from "../events";
import { JoinGameValidator } from "../validators";

export class JoinGameCommand implements ICommand {
	constructor(
		public readonly input: JoinGameInput,
		public readonly authUser: User
	) {}
}

@CommandHandler( JoinGameCommand )
export class JoinGameCommandHandler implements ICommandHandler<JoinGameCommand, GameWithPlayers> {

	private readonly logger = LoggerFactory.getLogger( JoinGameCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly validator: JoinGameValidator,
		private readonly eventBus: EventBus
	) {}

	async execute( { input, authUser }: JoinGameCommand ) {
		this.logger.debug( ">> executeJoinGameCommand()" );

		const { game, isUserAlreadyInGame } = await this.validator.validate( { input, authUser } );
		if ( isUserAlreadyInGame ) {
			return game;
		}

		const newPlayer = await this.prisma.literature.player.create( {
			data: {
				id: authUser.id,
				name: authUser.name,
				avatar: authUser.avatar,
				gameId: game.id
			}
		} );

		const isCapacityFull = game.playerCount === game.players.length + 1;
		this.eventBus.publish( new PlayerJoinedEvent( game.id, newPlayer, isCapacityFull ) );
		this.logger.debug( "Published PlayerJoinedEvent!" );

		this.logger.debug( "<< executeJoinGameCommand()" );
		return { ...game, players: [ ...game.players, newPlayer ] };
	}
}