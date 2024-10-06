import type { UserAuthInfo } from "@auth/api";
import { Injectable, NotFoundException } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { CardHand } from "@stairway/cards";
import { CallBreakPrisma } from "./callbreak.prisma.ts";
import type { Game, PlayerData } from "./callbreak.types.ts";

@Injectable()
export class CallBreakQueries {

	constructor(
		private readonly prisma: CallBreakPrisma,
		@OgmaLogger( CallBreakQueries ) private readonly logger: OgmaService
	) {}

	async getBaseGameData( gameId: string ) {
		this.logger.debug( ">> getBaseGameData()" );

		const data = await this.prisma.game.findUnique( {
			where: { id: gameId },
			include: { players: true }
		} );

		if ( !data ) {
			this.logger.error( "Game Not Found!" );
			throw new NotFoundException();
		}

		const { players, ...game } = data;
		const playerMap: PlayerData = {};
		players.forEach( player => {
			playerMap[ player.id ] = player;
		} );

		this.logger.debug( "<< getBaseGameData()" );
		return { game, players: playerMap };
	}

	async getGameData( game: Game, players: PlayerData, authInfo: UserAuthInfo ) {
		this.logger.debug( ">> getGameData()" );

		const deals = await this.prisma.deal.findMany( {
			where: { gameId: game.id },
			orderBy: { createdAt: "desc" },
			include: {
				rounds: {
					orderBy: { createdAt: "desc" }
				}
			}
		} );

		let hand = CardHand.empty();

		if ( deals.length > 0 ) {
			const cardMappings = await this.prisma.cardMapping.findMany( {
				where: { gameId: game.id, dealId: deals[ 0 ].id, playerId: authInfo.id }
			} );

			hand = CardHand.fromMappings( cardMappings );
		}

		this.logger.debug( "<< getGameData()" );
		return { game, players, deals, playerId: authInfo.id, hand: hand.serialize() };
	}
}