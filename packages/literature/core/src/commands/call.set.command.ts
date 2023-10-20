import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AggregatedGameData, CallMoveData, CallSetInput } from "@literature/data";
import { GameStatus, MoveType } from "@literature/data";
import { cardSetMap, getPlayingCardFromId, isCardSetInHand, shuffle } from "@s2h/cards";
import { BadRequestException } from "@nestjs/common";
import { LoggerFactory, PrismaService } from "@s2h/core";
import type { UserAuthInfo } from "@auth/data";
import { GameUpdateEvent, MoveCreatedEvent } from "../events";
import { Messages } from "../constants";
import { checkIfGameOver, rebuildHands } from "../utils";

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
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const calledPlayers = Array.from( new Set( Object.values( data ) ) ).map( playerId => {
			const player = currentGame.players[ playerId ];
			if ( !player ) {
				this.logger.error(
					"%s GameId: %s, PlayerId: %s",
					Messages.PLAYER_NOT_PART_OF_GAME,
					currentGame.id,
					playerId
				);
				throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
			}
			return player;
		} );

		if ( !Object.values( data ).includes( authInfo.id ) ) {
			this.logger.error( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, authInfo.id );
			throw new BadRequestException( Messages.DIDNT_CALL_OWN_CARDS );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, authInfo.id );
			throw new BadRequestException( Messages.MULTIPLE_SETS_CALLED );
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
			this.logger.error( "%s UserId: %s, Set: %s", Messages.SET_CALLED_WITHOUT_CARDS, authInfo.id, calledSet );
			throw new BadRequestException( Messages.SET_CALLED_WITHOUT_CARDS );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, authInfo.id );
			throw new BadRequestException( Messages.SET_CALLED_FROM_MULTIPLE_TEAMS );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.ALL_CARDS_NOT_CALLED, authInfo.id, calledSet );
			throw new BadRequestException( Messages.ALL_CARDS_NOT_CALLED );
		}

		const callingPlayer = currentGame.players[ authInfo.id ]!;
		const callingTeam = currentGame.teams[ callingPlayer.teamId! ];
		const oppositeTeam = currentGame.teamList.find( team => team.id !== callingPlayer.teamId )!;

		let success = true;
		let successString = "correctly!";
		let currentTurn = currentGame.currentTurn;

		const cardsOfCallingSet = cardSetMap[ calledSet ];
		for ( const card of cardsOfCallingSet ) {
			if ( correctCall[ card.id ] !== data[ card.id ] ) {
				success = false;
				successString = "incorrectly!";
				const oppositeTeamMembers = currentGame.playerList.filter(
					player => player.teamId !== callingPlayer.teamId
				);
				[ currentTurn ] = shuffle( oppositeTeamMembers ).map( player => player.id );
				break;
			}
		}

		await this.prisma.literature.cardMapping.deleteMany( {
			where: {
				cardId: { in: Object.keys( data ) }
			}
		} );

		Object.keys( data ).map( cardId => {
			delete currentGame.cardMappings[ cardId ];
		} );

		currentGame.hands = rebuildHands( currentGame.cardMappings );

		const callMoveData: CallMoveData = {
			by: authInfo.id,
			cardSet: calledSet,
			actualCall: data,
			correctCall
		};

		const move = await this.prisma.literature.move.create( {
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

		const updatedTeam = await this.prisma.literature.team.update( {
			where: {
				id: success ? callingPlayer.teamId! : oppositeTeam.id
			},
			data: {
				score: success ? callingTeam.score + 1 : oppositeTeam.score + 1,
				setsWon: success ? [ ...callingTeam.setsWon, calledSet ] : [ ...oppositeTeam.setsWon, calledSet ]
			}
		} );

		const isGameOver = checkIfGameOver( currentGame );
		const status = isGameOver ? GameStatus.COMPLETED : GameStatus.IN_PROGRESS;

		await this.prisma.literature.game.update( {
			where: { id: currentGame.id },
			data: { currentTurn, status }
		} );

		currentGame.currentTurn = currentTurn;
		currentGame.status = status;

		currentGame.teams[ updatedTeam.id ] = updatedTeam;
		currentGame.teamList = Object.values( currentGame.teams );
		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}