import { CardHand, PlayingCard } from "@s2h/cards";
import type { CallSetInput } from "@s2h/literature/dtos";
import type { ILiteratureGame, PlayerCallData } from "@s2h/literature/utils";
import { LiteratureGame, LiteratureMove } from "@s2h/literature/utils";
import { logger } from "@s2h/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";

function validate( ctx: LiteratureTrpcContext, input: CallSetInput ) {
	const calledCards = Object.values( input.data )
		.flatMap( playerCallData => playerCallData.cards )
		.map( PlayingCard.from );

	const calledCardIds = new Set( calledCards.map( card => card.id ) );
	const cardSets = new Set( calledCards.map( card => card.set ) );

	const hands: Record<string, CardHand> = {};
	Object.keys( ctx.currentGameHands! ).map( playerId => {
		hands[ playerId ] = CardHand.from( ctx.currentGameHands![ playerId ] );
	} );

	const user = ctx.loggedInUser!;
	const game = LiteratureGame.from( ctx.currentGame! );
	const callingPlayer = game.players[ user.id ];
	const callingPlayerHand = CardHand.from( ctx.currentGameHands![ callingPlayer.id ] );

	const calledPlayers = Object.keys( input.data ).map( playerId => {
		const player = game.players[ playerId ];
		if ( !player ) {
			logger.trace( "Input: %o", input );
			logger.trace( "Game: %o", game.serialize() );
			logger.error( "Called Player Not Found in Game! PlayerId: %s, UserId: %s", playerId, user.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
		}
		return player;
	} );

	if ( !Object.keys( input.data ).includes( user.id ) || input.data[ user.id ].cards.length === 0 ) {
		logger.trace( "Input: %o", input );
		logger.trace( "Game: %o", game.serialize() );
		logger.error( "Calling Player did not call own cards! UserId: %s", user.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CALL } );
	}

	if ( calledCardIds.size !== calledCards.length ) {
		logger.trace( "Input: %o", input );
		logger.trace( "Game: %o", game.serialize() );
		logger.error( "Same Cards called for multiple players! UserId: %s", user.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DUPLICATES_IN_CALL } );
	}

	if ( cardSets.size !== 1 ) {
		logger.trace( "Input: %o", input );
		logger.trace( "Game: %o", game.serialize() );
		logger.error( "Cards Called from multiple sets! UserId: %s", user.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_CARDS_OF_SAME_SET } );
	}

	const [ callingSet ] = cardSets;

	if ( !callingPlayerHand.cardSetsInHand.includes( callingSet ) ) {
		logger.trace( "Input: %o", input );
		logger.trace( "Game: %o", game.serialize() );
		logger.error( "Set called without having cards from that set! UserId: %s, Set: %s", user.id, callingSet );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_CALL_SET_THAT_YOU_DONT_HAVE } );
	}

	const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

	if ( calledTeams.size !== 1 ) {
		logger.trace( "Input: %o", input );
		logger.trace( "Game: %o", game.serialize() );
		logger.error( "Cards Called for players from multiple teams! UserId: %s", user.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_WITHIN_YOUR_TEAM } );
	}

	if ( calledCards.length !== 6 ) {
		logger.trace( "Input: %o", input );
		logger.trace( "Game: %o", game.serialize() );
		logger.error( "All Cards not called for the set! UserId: %s, Set: %s", user.id, callingSet );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_ALL_CARDS } );
	}

	return [ game, callingSet, hands ] as const;
}

export function callSet(): LiteratureResolver<CallSetInput, ILiteratureGame> {
	return async ( { ctx, input } ) => {
		const [ game, callingSet, hands ] = validate( ctx, input );
		const callData = { by: ctx.loggedInUser!.id, set: callingSet, data: input.data };
		const success = game.executeCallMove( callData, hands );

		const correctCall: Record<string, PlayerCallData> = {};
		Object.keys( hands ).map( playerId => {
			const removedCards = hands[ playerId ].removeCardsOfSet( callingSet );
			if ( removedCards.length !== 0 ) {
				correctCall[ playerId ] = { cards: removedCards };
			}
		} );

		const move = LiteratureMove.createCallMove( game.id, callData, success, correctCall );
		await ctx.db.moves().insertOne( move.serialize() );

		await ctx.db.games().updateOne( { id: game.id }, game.serialize() );
		return game;
	};
}
