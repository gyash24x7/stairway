import type { CreateGameInput } from "@s2h/literature/dtos";
import { ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import { db } from "@s2h/utils";
import type { LitResolver } from "../utils";

export function createGame(): LitResolver<CreateGameInput, ILiteratureGame> {
	return async ( { ctx, input } ) => {
		const game = LiteratureGame.create( input.playerCount || 2, ctx.loggedInUser! );
		await db.literature().insert( game.serialize() ).run( ctx.connection );
		return game;
	};
}