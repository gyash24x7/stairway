import type { LitMoveDataWithoutDescription, LitResolver } from "../types";
import type { StartGameInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";
import { LitGameStatus, LitMoveType } from "@prisma/client";

const startGameResolver: LitResolver<StartGameInput> = async ( { input, ctx } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	const handData = game.dealCardsAndGetHands();

	const updatedPlayers = await Promise.all(
		game.players.map( player => ctx.prisma.litPlayer.update( {
			where: { id: player.id },
			data: { hand: handData[ player.id ].serialize() }
		} ) )
	);

	game.handlePlayerUpdate( ...updatedPlayers );

	const firstMoveData: LitMoveDataWithoutDescription = {
		type: LitMoveType.TURN, turnId: game.loggedInPlayer?.id, gameId: input.gameId
	};

	const firstMove = await ctx.prisma.litMove.create( {
		data: { ...firstMoveData, description: game.getNewMoveDescription( firstMoveData ) }
	} );

	game.addMove( firstMove );

	await ctx.prisma.litGame.update( {
		where: { id: input.gameId },
		data: { status: LitGameStatus.IN_PROGRESS }
	} );

	game.status = LitGameStatus.IN_PROGRESS;

	ctx.litGamePublisher?.publish( game );
	return game;
};

export default startGameResolver;