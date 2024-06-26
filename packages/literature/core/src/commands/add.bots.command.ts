import { LoggerFactory } from "@common/core";
import type { GameData, PlayerData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { type Config, names, uniqueNamesGenerator } from "unique-names-generator";
import { PlayerJoinedEvent } from "../events";
import { DatabaseService } from "../services";
import { Messages } from "../utils";

export class AddBotsCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( AddBotsCommand )
export class AddBotsCommandHandler implements ICommandHandler<AddBotsCommand, PlayerData> {

	private readonly logger = LoggerFactory.getLogger( AddBotsCommandHandler );

	private readonly namesConfig: Config = {
		dictionaries: [ names ],
		separator: " ",
		length: 1
	};

	constructor(
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus
	) {}

	async validate( gameData: GameData ) {
		this.logger.debug( ">> validateAddBotsRequest()" );

		const remainingPlayers = gameData.playerCount - Object.keys( gameData.players ).length;

		if ( remainingPlayers <= 0 ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS } );
		}

		this.logger.debug( "<< validateAddBotsRequest()" );
		return remainingPlayers;
	}

	async execute( { gameData }: AddBotsCommand ) {
		this.logger.debug( ">> addBots()" );
		const botData: PlayerData = {};

		const botCount = await this.validate( gameData! );

		for ( let i = 0; i < botCount; i++ ) {
			const bot = await this.db.createPlayer( {
				gameId: gameData.id,
				name: uniqueNamesGenerator( this.namesConfig ),
				isBot: true
			} );

			botData[ bot.id ] = bot;
			const isCapacityFull = i === botCount - 1;
			this.eventBus.publish( new PlayerJoinedEvent( bot, isCapacityFull ) );
		}

		this.logger.debug( "<< addBots()" );
		return botData;
	};
}