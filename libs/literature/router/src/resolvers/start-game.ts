import type { LitResolverOptions, LitTrpcContext } from "../types";
import type { StartGameInput } from "@s2h/literature/dtos";
import { LitGameStatus, LitMoveType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";

function validate( ctx: LitTrpcContext ) {
	if ( ctx.currentGame!.status !== LitGameStatus.TEAMS_CREATED ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	return [ ctx.currentGame! ] as const;
}

export default async function ( { input, ctx }: LitResolverOptions<StartGameInput> ) {
	const [ game ] = validate( ctx );
	const handData = game.dealCardsAndGetHands();

	const updatedPlayers = await Promise.all(
		game.players.map( player => ctx.prisma.litPlayer.update( {
			where: { id: player.id },
			data: { hand: handData[ player.id ].serialize() }
		} ) )
	);

	game.handlePlayerUpdate( ...updatedPlayers );

	const firstMove = await ctx.prisma.litMove.create( {
		data: game.getNewMoveData( {
			type: LitMoveType.TURN,
			turnPlayer: game.loggedInPlayer!
		} )
	} );

	game.addMove( firstMove );

	await ctx.prisma.litGame.update( {
		where: { id: input.gameId },
		data: { status: LitGameStatus.IN_PROGRESS }
	} );

	game.status = LitGameStatus.IN_PROGRESS;

	ctx.litGamePublisher.publish( game );
	return game;
};