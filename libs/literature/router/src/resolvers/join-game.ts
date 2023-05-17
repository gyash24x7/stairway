import type { JoinGameInput } from "@s2h/literature/dtos";
import { EnhancedLitGame, IEnhancedLitGame, LiteratureGameStatus } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

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

export default async function ( { ctx, input }: LitResolverOptions<JoinGameInput> ): Promise<IEnhancedLitGame> {
	const game = await validate( ctx, input );

	if ( game.isUserAlreadyInGame( ctx.loggedInUser! ) ) {
		return game;
	}

	const player = await ctx.prisma.litPlayer.create( {
		data: game.generateNewPlayerData( ctx.loggedInUser! )
	} );

	game.addPlayer( player );

	game.status = game.players.length === game.playerCount
		? LiteratureGameStatus.PLAYERS_READY
		: LiteratureGameStatus.NOT_STARTED;

	await ctx.prisma.litGame.update( {
		where: { id: game.id },
		data: { status: game.status }
	} );

	ctx.litGamePublisher.publish( game );
	return game;
};