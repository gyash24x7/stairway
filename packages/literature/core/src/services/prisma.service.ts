import { Injectable } from "@nestjs/common";
import { BasePrismaService } from "@s2h/core";
import type { AggregatedGameData, CardMapping, CardMappingData, Player, RawGameData, Team } from "@literature/data";
import { getPlayingCardFromId, PlayingCard } from "@s2h/cards";

@Injectable()
export class PrismaService {

	constructor( private readonly prisma: BasePrismaService ) {}

	get game() {
		return this.prisma.literatureGame;
	}

	get player() {
		return this.prisma.literaturePlayer;
	}

	get cardMapping() {
		return this.prisma.literatureCardMapping;
	}

	get team() {
		return this.prisma.literatureTeam;
	}

	get move() {
		return this.prisma.literatureMove;
	}

	buildCardMappingsAndHandMap( cardMappings: CardMapping[] ): CardMappingData {
		const cardMappingMap: Record<string, string> = {};
		const handMap: Record<string, PlayingCard[]> = {};

		cardMappings.forEach( cardMapping => {
			cardMappingMap[ cardMapping.cardId ] = cardMapping.playerId;

			if ( !handMap[ cardMapping.playerId ] ) {
				handMap[ cardMapping.playerId ] = [];
			}

			handMap[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
		} );

		return { cardMappingMap, handMap };
	}

	buildAggregatedGameData( data: RawGameData ): AggregatedGameData {
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