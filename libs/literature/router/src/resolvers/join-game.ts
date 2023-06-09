import type { JoinGameInput } from "@s2h/literature/dtos";
import { ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";

async function validate( ctx: LiteratureTrpcContext, input: JoinGameInput ) {
	const game = await ctx.db.games().findOne( { code: input.code } );

	if ( !game ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	if ( Object.keys( game.players ).length >= game.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_CAPACITY_FULL } );
	}

	return [ LiteratureGame.from( game ) ] as const;
}

export function joinGame(): LiteratureResolver<JoinGameInput, ILiteratureGame> {
	return async ( { ctx, input } ) => {
		const [ game ] = await validate( ctx, input );

		if ( game.isUserAlreadyInGame( ctx.loggedInUser!.id ) ) {
			return game;
		}

		game.addPlayers( LiteraturePlayer.create( ctx.loggedInUser! ) );

		game.status = Object.keys( game.players ).length === game.playerCount
			? LiteratureGameStatus.PLAYERS_READY
			: LiteratureGameStatus.CREATED;

		await ctx.db.games().updateOne( { id: game.id }, game.serialize() );
		return game;
	};
}