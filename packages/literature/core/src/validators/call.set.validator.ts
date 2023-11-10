import { BadRequestException, Injectable } from "@nestjs/common";
import { CardSet, getPlayingCardFromId, isCardSetInHand } from "@s2h/cards";
import type { BusinessValidator } from "@s2h/core";
import { LoggerFactory } from "@s2h/core";
import type { CallSetCommand } from "../commands";
import { Messages } from "../constants";

export type CallSetValidatorResponse = {
	correctCall: Record<string, string>;
	calledSet: CardSet;
}

@Injectable()
export class CallSetValidator implements BusinessValidator<CallSetCommand, CallSetValidatorResponse> {

	private readonly logger = LoggerFactory.getLogger( CallSetValidator );

	async validate( { input: { data }, gameData, playerData, cardsData }: CallSetCommand ) {
		this.logger.debug( ">> validateCallSetCommand()" );
		const calledCards = Object.keys( data ).map( getPlayingCardFromId );
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const calledPlayers = Array.from( new Set( Object.values( data ) ) ).map( playerId => {
			const player = gameData.players[ playerId ];
			if ( !player ) {
				this.logger.error(
					"%s GameId: %s, PlayerId: %s",
					Messages.PLAYER_NOT_PART_OF_GAME,
					gameData.id,
					playerId
				);
				throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
			}
			return player;
		} );

		if ( !Object.values( data ).includes( playerData.id ) ) {
			this.logger.error( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, playerData.id );
			throw new BadRequestException( Messages.DIDNT_CALL_OWN_CARDS );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, playerData.id );
			throw new BadRequestException( Messages.MULTIPLE_SETS_CALLED );
		}

		const [ calledSet ] = cardSets;
		const correctCall: Record<string, string> = {};

		Object.keys( cardsData.mappings ).forEach( cardId => {
			const card = getPlayingCardFromId( cardId );
			if ( card.set === calledSet ) {
				correctCall[ cardId ] = cardsData.mappings[ cardId ];
			}
		} );

		if ( !isCardSetInHand( playerData.hand, calledSet ) ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.SET_CALLED_WITHOUT_CARDS, playerData.id, calledSet );
			throw new BadRequestException( Messages.SET_CALLED_WITHOUT_CARDS );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, playerData.id );
			throw new BadRequestException( Messages.SET_CALLED_FROM_MULTIPLE_TEAMS );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.ALL_CARDS_NOT_CALLED, playerData.id, calledSet );
			throw new BadRequestException( Messages.ALL_CARDS_NOT_CALLED );
		}

		this.logger.debug( "<< validateCallSetCommand()" );
		return { correctCall, calledSet };
	}
}