import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { JoinGameInput } from "@literature/data";
import { GameStatus } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { LoggerFactory } from "@s2h/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../services";

export class JoinGameCommand implements ICommand {
	constructor(
		public readonly input: JoinGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( JoinGameCommand )
export class JoinGameCommandHandler implements ICommandHandler<JoinGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( JoinGameCommandHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { input, authInfo }: JoinGameCommand ) {
		this.logger.debug( ">> execute()" );
		const game = await this.prisma.game.findUnique( {
			where: { code: input.code },
			include: { players: true }
		} );

		if ( !game ) {
			this.logger.error( "Game Not Found!" );
			throw new NotFoundException();
		}

		if ( game.players.length >= game.playerCount ) {
			this.logger.error( "The Game already has required players! GameId: %s", game.id );
			throw new BadRequestException();
		}

		const isUserAlreadyInGame = !!game.players.find( player => player.id === authInfo.id );

		if ( isUserAlreadyInGame ) {
			this.logger.warn( "The User is already part of the Game! GameId: %s", game.id );
			return game.id;
		}

		await this.prisma.player.create( {
			data: {
				id: authInfo.id,
				name: authInfo.name,
				avatar: authInfo.avatar,
				gameId: game.id
			}
		} );

		await this.prisma.game.update( {
			where: { id: game.id },
			data: {
				status: game.playerCount ? GameStatus.PLAYERS_READY : GameStatus.CREATED
			}
		} );

		return game.id;
	}
}