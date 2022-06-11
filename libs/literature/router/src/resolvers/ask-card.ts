import { LitMoveType } from "@prisma/client";
import type { LitMoveDataWithoutDescription, LitResolver } from "@s2h/utils";
import type { AskCardInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";

const askCardResolver: LitResolver<AskCardInput> = async ( { input, ctx } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	const newMoveData: LitMoveDataWithoutDescription = {
		askedFromId: input.askedFrom,
		askedById: game.loggedInPlayer?.id,
		askedFor: { ...input.askedFor },
		type: LitMoveType.ASK,
		gameId: input.gameId
	};

	const newMove = await ctx.prisma.litMove.create( {
		data: { ...newMoveData, description: game.getNewMoveDescription( newMoveData ) }
	} );

	game.addMove( newMove );
	ctx.litGamePublisher?.publish( game );
	return game;
};

export default askCardResolver;