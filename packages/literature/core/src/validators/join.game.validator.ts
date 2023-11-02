import type { GameWithPlayers } from "@literature/types";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { BusinessValidator } from "@s2h/core";
import { LoggerFactory, PrismaService } from "@s2h/core";
import type { JoinGameCommand } from "../commands";
import { Messages } from "../constants";

export type JoinGameValidatorResponse = {
	game: GameWithPlayers;
	isUserAlreadyInGame: boolean;
};

@Injectable()
export class JoinGameValidator implements BusinessValidator<JoinGameCommand, JoinGameValidatorResponse> {

	private readonly logger = LoggerFactory.getLogger( JoinGameValidator );

	constructor( private readonly prisma: PrismaService ) {}

	async validate( { input, authInfo }: JoinGameCommand ) {
		this.logger.debug( ">> validateJoinGameCommand()" );

		const game = await this.prisma.literature.game.findUnique( {
			where: { code: input.code },
			include: { players: true }
		} );

		if ( !game ) {
			this.logger.error( Messages.GAME_NOT_FOUND );
			throw new NotFoundException( Messages.GAME_NOT_FOUND );
		}

		this.logger.debug( "Found Game: %o", game.players.length );

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