import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { CreateTeamsInput, LiteratureGame, LiteratureGameStatus, LiteratureTeam } from "@literature/data";
import { BadRequestException } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { LiteratureService } from "../services";
import { LoggerFactory } from "@s2h/core";

export class CreateTeamsCommand implements ICommand {
	constructor(
		public readonly input: CreateTeamsInput,
		public readonly currentGame: LiteratureGame
	) {}
}

@CommandHandler( CreateTeamsCommand )
export class CreateTeamsCommandHandler implements ICommandHandler<CreateTeamsCommand, string> {

	private readonly logger = LoggerFactory.getLogger( CreateTeamsCommandHandler );

	constructor( private readonly literatureService: LiteratureService ) {}


	async execute( { input, currentGame }: CreateTeamsCommand ) {
		this.logger.debug( ">> execute()" );
		if ( currentGame.status !== LiteratureGameStatus.PLAYERS_READY ) {
			this.logger.error( "The Game is not in current status! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		if ( currentGame.playerIds.length !== currentGame.playerCount ) {
			this.logger.error( "The Game doesn't have enough players! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		const teams = Object.keys( input.data )
			.map( name => LiteratureTeam.create( new ObjectId().toHexString(), name, input.data[ name ] ) );

		currentGame.addTeams( teams );
		currentGame.status = LiteratureGameStatus.TEAMS_CREATED;

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}
}