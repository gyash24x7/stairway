import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { JoinGameInput, LiteratureGameStatus, LiteraturePlayer } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { LiteratureService } from "../services";
import { LoggerFactory } from "@s2h/core";
import { BadRequestException } from "@nestjs/common";

export class JoinGameCommand implements ICommand {
	constructor(
		public readonly input: JoinGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( JoinGameCommand )
export class JoinGameCommandHandler implements ICommandHandler<JoinGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( JoinGameCommandHandler );

	constructor( private readonly literatureService: LiteratureService ) {}


	async execute( { input, authInfo }: JoinGameCommand ) {
		this.logger.debug( ">> execute()" );
		const game = await this.literatureService.findGameByCode( input.code );

		if ( game.playerIds.length >= game.playerCount ) {
			this.logger.error( "The Game already has required players! GameId: %s", game.id );
			throw new BadRequestException();
		}

		if ( game.isUserAlreadyInGame( authInfo.id ) ) {
			this.logger.warn( "The User is already part of the Game! GameId: %s", game.id );
			return game.id;
		}

		game.addPlayers( LiteraturePlayer.createFromAuthInfo( authInfo ) );

		game.status = game.playerIds.length === game.playerCount
			? LiteratureGameStatus.PLAYERS_READY
			: LiteratureGameStatus.CREATED;

		await this.literatureService.saveGame( game );
		return game.id;
	}
}