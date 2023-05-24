import { CardHand, PlayingCard } from "@s2h/cards";
import type { CallSetInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolver, LitTrpcContext } from "../types";
import { r } from "../db";

function validate( ctx: LitTrpcContext, input: CallSetInput ) {
	const calledCards = Object.values( input.data ).flat().map( PlayingCard.from );
	const calledCardIds = new Set( calledCards.map( card => card.id ) );
	const cardSets = new Set( calledCards.map( card => card.set ) );
	const callingPlayer = ctx.currentGame!.players[ ctx.loggedInUser!.id ];

	const calledPlayers = Object.keys( input.data ).map( playerId => {
		const player = ctx.currentGame!.players[ playerId ];
		if ( !player ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
		}
		return player;
	} );

	if ( !Object.keys( input.data ).includes( ctx.loggedInUser!.id ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CALL } );
	}

	if ( calledCardIds.size !== calledCards.length ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DUPLICATES_IN_CALL } );
	}

	if ( cardSets.size !== 1 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_CARDS_OF_SAME_SET } );
	}

	const [ callingSet ] = cardSets;

	if ( !CardHand.from( callingPlayer.hand! ).cardSetsInHand.includes( callingSet ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_CALL_SET_THAT_YOU_DONT_HAVE } );
	}

	const calledTeams = new Set( calledPlayers.map( player => player.team ) );

	if ( calledTeams.size !== 1 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_WITHIN_YOUR_TEAM } );
	}

	if ( calledCards.length !== 6 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_ALL_CARDS } );
	}

	return [ LiteratureGame.from( ctx.currentGame! ), callingSet ] as const;
}

export function callSet(): LitResolver<CallSetInput, ILiteratureGame> {
	return async ( { ctx, input } ) => {
		const [ game, callingSet ] = validate( ctx, input );
		game.executeMoveAction( {
			action: "CALL_SET",
			callData: {
				playerId: ctx.loggedInUser!.id,
				set: callingSet,
				data: input.data
			}
		} );

		await r.literature().get( game.id ).update( game.serialize() ).run( ctx.connection );
		return game;
	};
}
