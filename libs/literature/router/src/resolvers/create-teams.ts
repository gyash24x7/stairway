import type { CreateTeamsInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame, LiteratureGameStatus } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

function validate( ctx: LitTrpcContext ) {
	if ( ctx.currentGame!.status !== LiteratureGameStatus.PLAYERS_READY ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	if ( Object.keys( ctx.currentGame!.players ).length !== ctx.currentGame!.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NOT_ENOUGH_PLAYERS } );
	}

	return [ LiteratureGame.from( ctx.currentGame! ) ] as const;
}

export async function createTeams( { input, ctx }: LitResolverOptions<CreateTeamsInput> ): Promise<ILiteratureGame> {
	const [ game ] = validate( ctx );
	game.createTeams( input.teams );
	game.status = LiteratureGameStatus.TEAMS_CREATED;

	await ctx.literatureTable.get( input.gameId ).update( game.serialize() ).run( ctx.connection );
	ctx.litGamePublisher.publish( game );
	return game;
}