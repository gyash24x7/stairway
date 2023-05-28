import type { StartGameInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { db, LiteratureGame, LiteratureGameStatus } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";

function validate( ctx: LiteratureTrpcContext ) {
	if ( ctx.currentGame!.status !== LiteratureGameStatus.TEAMS_CREATED ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	return [ LiteratureGame.from( ctx.currentGame! ) ] as const;
}

export function startGame(): LiteratureResolver<StartGameInput, ILiteratureGame> {
	return async ( { input, ctx } ) => {
		const [ game ] = validate( ctx );
		game.dealCards();
		game.status = LiteratureGameStatus.IN_PROGRESS;

		await db.literature().get( input.gameId ).update( game.serialize() ).run( ctx.connection );
		return game;
	};
}