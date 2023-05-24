import type { ChanceTransferInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame } from "@s2h/literature/utils";
import { db } from "@s2h/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolver, LitTrpcContext } from "../utils";

function validate( ctx: LitTrpcContext ) {
	const game = LiteratureGame.from( ctx.currentGame! );
	const lastMove = game.moves[ 0 ];

	if ( lastMove.resultData.result !== "CALL_SET" || !lastMove.resultData.success ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CHANCE_TRANSFER } );
	}

	return [ game ] as const;
}

export function chanceTransfer(): LitResolver<ChanceTransferInput, ILiteratureGame> {
	return async ( { input, ctx } ) => {
		const [ game ] = validate( ctx );

		game.executeMoveAction( {
			action: "CHANCE_TRANSFER",
			transferData: {
				playerId: input.transferTo
			}
		} );

		await db.literature().get( game.id ).update( game.serialize() ).run( ctx.connection );
		return game;
	};
}
