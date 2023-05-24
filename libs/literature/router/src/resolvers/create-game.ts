import type { CreateGameInput } from "@s2h/literature/dtos";
import { ILiteratureGame, LiteratureGame } from "@s2h/literature/utils";
import type { LitResolver } from "../types";
import { r } from "../db";

export function createGame(): LitResolver<CreateGameInput, ILiteratureGame> {
	return async ( { ctx, input } ) => {
		const game = LiteratureGame.create( input.playerCount || 2, ctx.loggedInUser! );
		await r.literature().insert( game.serialize() ).run( ctx.connection );
		return game;
	};
}