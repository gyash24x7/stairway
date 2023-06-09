import type { CreateGameInput } from "@s2h/literature/dtos";
import { ILiteratureGame, LiteratureGame, LiteraturePlayer } from "@s2h/literature/utils";
import type { LiteratureResolver } from "../utils";

export function createGame(): LiteratureResolver<CreateGameInput, ILiteratureGame> {
	return async ( { ctx, input } ) => {
		const game = LiteratureGame.create( input.playerCount || 2, ctx.loggedInUser! );
		const player = LiteraturePlayer.create( ctx.loggedInUser! );
		game.addPlayers( player );
		await ctx.db.games().insertOne( game.serialize() );
		return game;
	};
}