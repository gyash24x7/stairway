import type { StartGameInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame, LiteratureGameStatus } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

function validate( ctx: LitTrpcContext ) {
	if ( ctx.currentGame!.status !== LiteratureGameStatus.TEAMS_CREATED ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	return [ LiteratureGame.from( ctx.currentGame! ) ] as const;
}

export async function startGame( { input, ctx }: LitResolverOptions<StartGameInput> ): Promise<ILiteratureGame> {
	const [ game ] = validate( ctx );
	game.dealCards();
	game.status = LiteratureGameStatus.IN_PROGRESS;

	await ctx.literatureTable.get( input.gameId ).update( game.serialize() ).run( ctx.connection );
	ctx.litGamePublisher.publish( game );
	return game;
}