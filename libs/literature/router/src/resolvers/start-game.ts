import type { StartGameInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame, LiteratureGameHand, LiteratureGameStatus } from "@s2h/literature/utils";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { createId } from "@paralleldrive/cuid2";

function validate( ctx: LiteratureTrpcContext ) {
	if ( ctx.currentGame!.status !== LiteratureGameStatus.TEAMS_CREATED ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	return [ LiteratureGame.from( ctx.currentGame! ) ] as const;
}

export function startGame(): LiteratureResolver<StartGameInput, ILiteratureGame> {
	return async ( { ctx } ) => {
		const [ game ] = validate( ctx );
		const hands = game.dealCards();
		await Promise.all(
			Object.keys( hands ).map( playerId => {
				ctx.db.hands().insertOne(
					LiteratureGameHand.from(
						{ gameId: game.id, playerId, hand: hands[ playerId ], id: createId() }
					)
				);
			} )
		);
		game.status = LiteratureGameStatus.IN_PROGRESS;

		await ctx.db.games().updateOne( { id: game.id }, game.serialize() );
		return game;
	};
}