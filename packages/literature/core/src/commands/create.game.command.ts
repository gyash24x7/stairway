import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { CreateGameInput, LiteratureGame, LiteraturePlayer } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { ObjectId } from "mongodb";
import { LiteratureService } from "../services";
import { LoggerFactory } from "@s2h/core";

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor( private readonly literatureService: LiteratureService ) {}

	async execute( { input, authInfo }: CreateGameCommand ) {
		this.logger.debug( ">> execute()" );
		const id = new ObjectId();
		const game = LiteratureGame.createNew( id.toHexString(), input.playerCount || 2, authInfo );
		const player = LiteraturePlayer.createFromAuthInfo( authInfo );
		game.addPlayers( player );
		await this.literatureService.createGame( game );
		return id.toHexString();
	}
}