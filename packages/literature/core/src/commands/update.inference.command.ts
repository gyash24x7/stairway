import type { AskMove, CallMove, InferenceData, Move, PlayerData } from "@literature/types";
import { MoveType } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus, QueryBus } from "@nestjs/cqrs";
import { getPlayingCardFromId } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { InferenceUpdatedEvent } from "../events";
import { InferenceDataQuery } from "../queries";

export class UpdateInferenceCommand implements ICommand {
	constructor(
		public readonly currentMove: Move,
		public readonly players: PlayerData
	) {}
}

@CommandHandler( UpdateInferenceCommand )
export class UpdateInferenceCommandHandler implements ICommandHandler<UpdateInferenceCommand, InferenceData> {

	private readonly logger = LoggerFactory.getLogger( UpdateInferenceCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly queryBus: QueryBus,
		private readonly eventBus: EventBus
	) {}

	async execute( { currentMove, players }: UpdateInferenceCommand ) {
		this.logger.debug( ">> executeUpdateInferencesCommand()" );

		let inferences: InferenceData = await this.queryBus.execute(
			new InferenceDataQuery( currentMove.gameId )
		);

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD:
				inferences = this.updateInferencesOnAskMove( currentMove as AskMove, inferences, players );
				break;

			case MoveType.CALL_SET:
				inferences = this.updateInferencesOnCallMove( currentMove as CallMove, inferences );
				break;
		}

		if ( currentMove.type !== MoveType.TRANSFER_TURN ) {
			await Promise.all( Object.keys( inferences ).map( playerId => {
				return this.prisma.literature.inference.update( {
					where: { gameId_playerId: { playerId, gameId: currentMove.gameId } },
					data: inferences[ playerId ]
				} );
			} ) );

			this.eventBus.publish( new InferenceUpdatedEvent( currentMove.gameId, inferences ) );
			this.logger.debug( "Published InferenceUpdatedEvent!" );
		}

		this.logger.debug( "<< executeUpdateInferencesCommand()" );
		return inferences;
	}

	private updateInferencesOnCallMove( move: CallMove, inferences: InferenceData ) {
		Object.keys( inferences ).map( playerId => {
			const {
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations,
				activeSets
			} = inferences[ playerId ];

			Object.keys( move.data.correctCall ).map( card => {
				delete actualCardLocations[ card ];
				delete possibleCardLocations[ card ];
				delete inferredCardLocations[ card ];
			} );

			Object.keys( activeSets ).forEach( teamId => {
				const activeSetsSet = new Set( activeSets[ teamId ] );
				activeSetsSet.delete( move.data.cardSet );
				activeSets[ teamId ] = Array.from( activeSetsSet );
			} );

			inferences[ playerId ] = {
				...inferences[ playerId ],
				activeSets,
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations
			};
		} );

		return inferences;
	}

	private updateInferencesOnAskMove( move: AskMove, inferences: InferenceData, players: PlayerData ) {
		Object.keys( inferences ).map( playerId => {
			const {
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations,
				activeSets
			} = inferences[ playerId ];

			if ( move.success ) {
				actualCardLocations[ move.data.card ] = move.data.by;
				possibleCardLocations[ move.data.card ] = [ move.data.by ];
			} else {
				possibleCardLocations[ move.data.card ] = possibleCardLocations[ move.data.card ]
					.filter( playerId => playerId !== move.data.from && playerId !== move.data.by );
			}

			const teamId = players[ move.data.by ].teamId!;
			const { set } = getPlayingCardFromId( move.data.card );
			const activeSetsSet = new Set( activeSets[ teamId ] );
			activeSetsSet.add( set );
			activeSets[ teamId ] = Array.from( activeSetsSet );

			inferences[ playerId ] = {
				...inferences[ playerId ],
				activeSets,
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations
			};
		} );

		return inferences;
	}
}