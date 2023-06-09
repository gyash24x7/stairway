import type { CreateTeamsInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame, LiteratureGameStatus } from "@s2h/literature/utils";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";

function validate( ctx: LiteratureTrpcContext ) {
	if ( ctx.currentGame!.status !== LiteratureGameStatus.PLAYERS_READY ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	if ( Object.keys( ctx.currentGame!.players ).length !== ctx.currentGame!.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NOT_ENOUGH_PLAYERS } );
	}

	return [ LiteratureGame.from( ctx.currentGame! ) ] as const;
}

export function createTeams(): LiteratureResolver<CreateTeamsInput, ILiteratureGame> {
	return async ( { input, ctx } ) => {
		const [ game ] = validate( ctx );
		game.createTeams( input.teams );
		game.status = LiteratureGameStatus.TEAMS_CREATED;

		await ctx.db.games().updateOne( { id: game.id }, game.serialize() );
		return game;
	};
}