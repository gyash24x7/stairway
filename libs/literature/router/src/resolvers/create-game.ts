import type { CreateGameInput } from "@s2h/literature/dtos";
import { db, ILiteratureGame, LiteratureGame, LiteraturePlayer } from "@s2h/literature/utils";
import type { LitResolver } from "../utils";

export function createGame(): LitResolver<CreateGameInput, ILiteratureGame> {
	return async ( { ctx, input } ) => {
		const game = LiteratureGame.create( input.playerCount || 2, ctx.loggedInUser! );
		const player = LiteraturePlayer.create( ctx.loggedInUser! );
		game.addPlayers( player );
		await db.literature().insert( game.serialize() ).run( ctx.connection );
		return game;
	};
}