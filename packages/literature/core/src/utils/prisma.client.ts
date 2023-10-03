import type { AggregatedGameData } from "@literature/data";
import type { Player, Team } from "@literature/prisma";
import { PrismaClient } from "@literature/prisma";
import type { PlayingCard } from "@s2h/cards";
import { getPlayingCardFromId } from "@s2h/cards";

const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends( {
	model: {
		game: {
			async getAggregatedData( gameId: string ): Promise<AggregatedGameData> {
				const data = await basePrisma.game.findUniqueOrThrow( {
					where: { id: gameId },
					include: {
						players: true,
						teams: true,
						cardMappings: true,
						moves: {
							take: 5,
							orderBy: {
								timestamp: "desc"
							}
						}
					}
				} );

				const playerMap: Record<string, Player> = {};
				data.players.forEach( player => {
					playerMap[ player.id ] = player;
				} );

				const teamMap: Record<string, Team> = {};
				data.teams.forEach( team => {
					teamMap[ team.id ] = team;
				} );

				const cardMappingMap: Record<string, string> = {};
				const cardHandMap: Record<string, PlayingCard[]> = {};
				data.cardMappings.forEach( cardMapping => {
					cardMappingMap[ cardMapping.cardId ] = cardMapping.playerId;

					if ( !cardHandMap[ cardMapping.playerId ] ) {
						cardHandMap[ cardMapping.playerId ] = [];
					}

					cardHandMap[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
				} );

				return {
					...data,
					players: playerMap,
					teams: teamMap,
					cardMappings: cardMappingMap,
					playerList: data.players,
					teamList: data.teams,
					hands: cardHandMap
				};
			}
		}
	}
} );