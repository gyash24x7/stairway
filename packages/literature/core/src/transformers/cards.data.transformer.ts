import type { CardMapping, CardMappingData, CardsData, HandData } from "@literature/types";
import { Injectable } from "@nestjs/common";
import { getPlayingCardFromId } from "@s2h/cards";
import type { DataTransformer } from "@s2h/core";
import { LoggerFactory } from "@s2h/core";

@Injectable()
export class CardsDataTransformer implements DataTransformer<CardMapping[], CardsData> {

	private readonly logger = LoggerFactory.getLogger( CardsDataTransformer );

	transform( cardMappings: CardMapping[] ): CardsData {
		this.logger.debug( ">> transformCardMappings()" );

		const mappings: CardMappingData = {};
		const hands: HandData = {};

		cardMappings.forEach( cardMapping => {
			if ( !hands[ cardMapping.playerId ] ) {
				hands[ cardMapping.playerId ] = [];
			}

			hands[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
			mappings[ cardMapping.cardId ] = cardMapping.playerId;
		} );

		this.logger.debug( "<< transformCardMappings()" );
		return { mappings, hands };
	}
}