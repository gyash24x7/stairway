import cuid from "cuid";
import type { LitResolver } from "@s2h/utils";
import type { CreateGameInput } from "@s2h/literature/dtos";
import type { User } from "@prisma/client";
import { EnhancedLitGame } from "@s2h/literature/utils";

const createGameResolver: LitResolver<CreateGameInput> = async ( { ctx, input } ) => {
	const { name, avatar, id } = ctx.res?.locals[ "user" ] as User;

	const game = await ctx.prisma.litGame.create( {
		include: { players: true },
		data: {
			createdById: id,
			code: cuid.slug().toUpperCase(),
			players: {
				create: { name, avatar, hand: [], userId: id }
			},
			playerCount: input.playerCount
		}
	} );

	return EnhancedLitGame.from( { ...game, moves: [], teams: [] } );
};

export default createGameResolver;