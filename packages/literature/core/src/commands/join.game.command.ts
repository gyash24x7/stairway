import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { JoinGameInput } from "@literature/data";
import { GameStatus } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GameUpdateEvent } from "../events";
import { buildAggregatedGameData } from "../utils";
import { Messages } from "../constants";

export class JoinGameCommand implements ICommand {
	constructor(
		public readonly input: JoinGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( JoinGameCommand )
export class JoinGameCommandHandler implements ICommandHandler<JoinGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( JoinGameCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { input, authInfo }: JoinGameCommand ) {
		this.logger.debug( ">> execute()" );
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
			return game.id;
		}

		if ( game.players.length >= game.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id );
			throw new BadRequestException( Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
		}

		const newPlayer = await this.prisma.literature.player.create( {
			data: {
				id: authInfo.id,
				name: authInfo.name,
				avatar: authInfo.avatar,
				gameId: game.id
			}
		} );

		if ( game.playerCount === game.players.length + 1 ) {
			await this.prisma.literature.game.update( {
				where: { id: game.id },
				data: { status: GameStatus.PLAYERS_READY }
			} );

			game.status = GameStatus.PLAYERS_READY;
		}

		const aggregatedData = buildAggregatedGameData( { ...game, players: [ ...game.players, newPlayer ] } );
		this.eventBus.publish( new GameUpdateEvent( aggregatedData, authInfo ) );

		return game.id;
	}
}