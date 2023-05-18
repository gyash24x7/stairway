import type { CreateGameInput } from "@s2h/literature/dtos";
import { ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import type { LitResolverOptions } from "../types";

export async function createGame( { ctx, input }: LitResolverOptions<CreateGameInput> ): Promise<ILiteratureGame> {
	const game = LiteratureGame.create( input.playerCount || 2, ctx.loggedInUser! );
	await ctx.literatureTable.insert( game.serialize() ).run( ctx.connection );
	return game;
}