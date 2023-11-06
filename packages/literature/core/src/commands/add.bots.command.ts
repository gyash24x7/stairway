import type { GameData, PlayerData } from "@literature/types";
import type { EventBus, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { Constants } from "../constants";
import { PlayerJoinedEvent } from "../events";
import { AddBotsValidator } from "../validators";

export class AddBotsCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( AddBotsCommand )
export class AddBotsCommandHandler implements ICommandHandler<AddBotsCommand, PlayerData> {

	private readonly logger = LoggerFactory.getLogger( AddBotsCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly validator: AddBotsValidator,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData }: AddBotsCommand ): Promise<PlayerData> {
		this.logger.debug( ">> executeAddBotsCommand()" );
		const botData: PlayerData = {};

		const botCount = await this.validator.validate( { gameData } );

		for ( let i = 0; i < botCount; i++ ) {
			const bot = await this.prisma.literature.player.create( {
				data: {
					gameId: gameData.id,
					name: `Bot ${ i + 1 }`,
					avatar: Constants.AVATAR_BASE_URL + `bot${ i + 1 }`,
					isBot: true
				}
			} );

			botData[ bot.id ] = bot;
			this.eventBus.publish( new PlayerJoinedEvent( gameData.id, bot, i < botCount - 1 ) );
		}

		this.logger.debug( "<< executeAddBotsCommand()" );
		return botData;
	}
}