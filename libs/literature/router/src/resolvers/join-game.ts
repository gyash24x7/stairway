import type { LitResolverOptions, LitTrpcContext } from "../types";
import { Messages } from "../constants"
import type { JoinGameInput } from "@s2h/literature/dtos";
import { LitGameStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { EnhancedLitGame } from "@s2h/literature/utils";

async function validate( ctx: LitTrpcContext, input: JoinGameInput ) {
	const game = await ctx.prisma.litGame.findFirst( {
		where: { code: input.code },
		include: { players: true }
	} );

	if ( !game ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	const enhancedGame = EnhancedLitGame.from( { ...game, moves: [], teams: [] } );

	if ( game.players.length >= game.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_CAPACITY_FULL } );
	}

	return enhancedGame;
}

export default async function ( { ctx, input }: LitResolverOptions<JoinGameInput> ) {
	const game = await validate( ctx, input );

	if ( game.isUserAlreadyInGame( ctx.loggedInUser! ) ) {
		return game;
	}

	const player = await ctx.prisma.litPlayer.create( {
		data: game.generateNewPlayerData( ctx.loggedInUser! )
	} );

	game.addPlayer( player );

	game.status = game.players.length === game.playerCount
		? LitGameStatus.PLAYERS_READY
		: LitGameStatus.NOT_STARTED;

	await ctx.prisma.litGame.update( {
		where: { id: game.id },
		data: { status: game.status }
	} );

	ctx.litGamePublisher.publish( game );
	return game;
};