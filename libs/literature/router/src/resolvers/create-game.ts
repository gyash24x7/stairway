import { EnhancedLitGame, IEnhancedLitGame } from "@s2h/literature/utils";
import type { LitResolverOptions } from "../types";
import type { CreateGameInput } from "@s2h/literature/dtos";

export default async function ( { ctx, input }: LitResolverOptions<CreateGameInput> ): Promise<IEnhancedLitGame> {
	const game = await ctx.prisma.litGame.create( {
		data: EnhancedLitGame.generateNewGameData( {
			playerCount: input.playerCount,
			createdBy: ctx.loggedInUser!
		} )
	} );

	const enhancedGame = EnhancedLitGame.from( { ...game, moves: [], teams: [], players: [] } );
	const player = await ctx.prisma.litPlayer.create( {
		data: enhancedGame.generateNewPlayerData( ctx.loggedInUser! )
	} );

	enhancedGame.addPlayer( player );
	return enhancedGame;
};