import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { CallMoveData, CallSetInput, LiteratureGame, LiteratureMove, LiteraturePlayer } from "@literature/data";
import { CardHand, PlayingCard } from "@s2h/cards";
import { BadRequestException } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { LoggerFactory } from "@s2h/core";
import { LiteratureService } from "../services";

export class CallSetCommand implements ICommand {
	constructor(
		public readonly input: CallSetInput,
		public readonly currentGame: LiteratureGame,
		public readonly currentPlayer: LiteraturePlayer,
		public readonly currentGameHands: Record<string, CardHand>
	) {}
}

@CommandHandler( CallSetCommand )
export class CallSetCommandHandler implements ICommandHandler<CallSetCommand, string> {

	private readonly logger = LoggerFactory.getLogger( CallSetCommandHandler );

	constructor( private readonly literatureService: LiteratureService ) {}


	async execute( { input: { data }, currentGame, currentPlayer, currentGameHands }: CallSetCommand ) {
		const calledCards = Object.values( data ).flat().map( PlayingCard.from );
		const calledCardIds = new Set( calledCards.map( card => card.cardId ) );
		const cardSets = new Set( calledCards.map( card => card.cardSet ) );

		const callingPlayerHand = currentGameHands[ currentPlayer.id ];
		const calledPlayers = Object.keys( data ).map( playerId => {
			const player = currentGame.players[ playerId ];
			if ( !player ) {
				this.logger.trace( "Input: %o", { data } );
				this.logger.trace( "Game: %o", currentGame );
				this.logger.error(
					"Called Player Not Found in Game! PlayerId: %s, UserId: %s",
					playerId,
					currentPlayer.id
				);
				throw new BadRequestException();
			}
			return player;
		} );

		if ( !Object.keys( data ).includes( currentPlayer.id ) || data[ currentPlayer.id ].length === 0 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Calling Player did not call own cards! UserId: %s", currentPlayer.id );
			throw new BadRequestException();
		}

		if ( calledCardIds.size !== calledCards.length ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Same Cards called for multiple players! UserId: %s", currentPlayer.id );
			throw new BadRequestException();
		}

		if ( cardSets.size !== 1 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Cards Called from multiple sets! UserId: %s", currentPlayer.id );
			throw new BadRequestException();
		}

		const [ callingSet ] = cardSets;

		if ( !callingPlayerHand.cardSetsInHand.includes( callingSet ) ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error(
				"Set called without cards from that set! UserId: %s, Set: %s",
				currentPlayer.id,
				callingSet
			);
			throw new BadRequestException();
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Cards Called for players from multiple teams! UserId: %s", currentPlayer.id );
			throw new BadRequestException();
		}

		if ( calledCards.length !== 6 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error(
				"All Cards not called for the set! UserId: %s, Set: %s",
				currentPlayer.id,
				callingSet
			);
			throw new BadRequestException();
		}

		const actualCall: Record<string, PlayingCard[]> = {};
		Object.keys( data ).forEach( playerId => {
			actualCall[ playerId ] = data[ playerId ].map( PlayingCard.from );
		} );

		const callData: CallMoveData = {
			by: currentPlayer.id,
			cardSet: callingSet,
			actualCall,
			correctCall: {}
		};

		const success = currentGame.executeCallMove( callData, currentGameHands );
		Object.keys( currentGameHands ).map( playerId => {
			const removedCards = currentGameHands[ playerId ].removeCardsOfSet( callingSet );
			if ( removedCards.length !== 0 ) {
				callData.correctCall[ playerId ] = removedCards;
			}
		} );

		const moveId = new ObjectId().toHexString();
		const move = LiteratureMove.buildCallMove( moveId, currentGame.id, callData, success );
		await this.literatureService.saveMove( move );

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}
}