import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AggregatedGameData, CallMoveData, CallSetInput } from "@literature/data";
import { MoveType } from "@literature/data";
import { cardSetMap, getPlayingCardFromId, isCardSetInHand } from "@s2h/cards";
import { BadRequestException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { UserAuthInfo } from "@auth/data";
import { PrismaService } from "../services";
import { GameUpdateEvent, MoveCreatedEvent } from "../events";

export class CallSetCommand implements ICommand {
	constructor(
		public readonly input: CallSetInput,
		public readonly currentGame: AggregatedGameData,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( CallSetCommand )
export class CallSetCommandHandler implements ICommandHandler<CallSetCommand, string> {

	private readonly logger = LoggerFactory.getLogger( CallSetCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { input: { data }, currentGame, authInfo }: CallSetCommand ) {
		const calledCards = Object.keys( data ).map( getPlayingCardFromId );
		const calledCardIds = new Set( Object.keys( data ) );
		const cardSuits = new Set( calledCards.map( card => card.suit ) );
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const calledPlayers = Array.from( new Set( Object.values( data ) ) ).map( playerId => {
			const player = currentGame.players[ playerId ];
			if ( !player ) {
				this.logger.trace( "Input: %o", { data } );
				this.logger.trace( "Game: %o", currentGame );
				this.logger.error(
					"Called Player Not Found in Game! PlayerId: %s, UserId: %s",
					playerId,
					authInfo.id
				);
				throw new BadRequestException();
			}
			return player;
		} );

		if ( !Object.values( data ).includes( authInfo.id ) ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Calling Player did not call own cards! UserId: %s", authInfo.id );
			throw new BadRequestException();
		}

		if ( calledCardIds.size !== calledCards.length ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Same Cards called for multiple players! UserId: %s", authInfo.id );
			throw new BadRequestException();
		}

		if ( cardSets.size !== 1 || cardSuits.size !== 1 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Cards Called from multiple sets! UserId: %s", authInfo.id );
			throw new BadRequestException();
		}

		const [ calledSet ] = cardSets;
		const callingPlayerHand = currentGame.hands[ authInfo.id ];
		const correctCall: Record<string, string> = {};

		Object.keys( currentGame.cardMappings ).forEach( cardId => {
			const card = getPlayingCardFromId( cardId );
			if ( card.set === calledSet ) {
				correctCall[ cardId ] = currentGame.cardMappings[ cardId ];
			}
		} );

		if ( !isCardSetInHand( callingPlayerHand, calledSet ) ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error(
				"Set called without cards from that set! UserId: %s, Set: %s",
				authInfo.id,
				calledSet
			);
			throw new BadRequestException();
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Cards Called for players from multiple teams! UserId: %s", authInfo.id );
			throw new BadRequestException();
		}

		if ( calledCards.length !== 6 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error(
				"All Cards not called for the set! UserId: %s, Set: %s",
				authInfo.id,
				calledSet
			);
			throw new BadRequestException();
		}

		const callingPlayer = currentGame.players[ authInfo.id ]!;
		const callingTeam = currentGame.teams[ callingPlayer.teamId! ];
		const oppositeTeam = currentGame.teamList.find( team => team.id !== callingPlayer.teamId )!;

		let success = true;
		let successString = "correctly!";

		const cardsOfCallingSet = cardSetMap[ calledSet ];
		for ( const card of cardsOfCallingSet ) {
			if ( correctCall[ card.id ] !== data[ card.id ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		await this.prisma.cardMapping.deleteMany( {
			where: {
				cardId: { in: Object.keys( data ) }
			}
		} );

		Object.keys( data ).map( cardId => {
			delete currentGame.cardMappings[ cardId ];
		} );

		const callMoveData: CallMoveData = {
			by: authInfo.id,
			cardSet: calledSet,
			actualCall: data,
			correctCall
		};

		const move = await this.prisma.move.create( {
			data: {
				gameId: currentGame.id,
				type: MoveType.CALL_SET,
				success,
				description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
				data: callMoveData
			}
		} );

		this.eventBus.publish( new MoveCreatedEvent( move ) );
		currentGame.moves = [ move, ...currentGame.moves ];

		const updatedTeam = await this.prisma.team.update( {
			where: {
				id: success ? callingPlayer.teamId! : oppositeTeam.id
			},
			data: {
				score: success ? callingTeam.score + 1 : oppositeTeam.score + 1,
				setsWon: success ? [ ...callingTeam.setsWon, calledSet ] : [ ...oppositeTeam.setsWon, calledSet ]
			}
		} );

		currentGame.teams[ updatedTeam.id ] = updatedTeam;
		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}