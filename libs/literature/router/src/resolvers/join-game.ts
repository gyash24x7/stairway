import type { JoinGameInput } from "@s2h/literature/dtos";
import { db, ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";
import { CardHand } from "@s2h/cards";

async function validate( ctx: LiteratureTrpcContext, input: JoinGameInput ) {
	const [ game ] = await db.literature().filter( { code: input.code } ).run( ctx.connection );

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
		const { id, name, avatar } = ctx.loggedInUser!;

		if ( game.isUserAlreadyInGame( id ) ) {
			return game;
		}

		game.addPlayers( LiteraturePlayer.from( { id, name, avatar, hand: CardHand.empty() } ) );

		game.status = Object.keys( game.players ).length === game.playerCount
			? LiteratureGameStatus.PLAYERS_READY
			: LiteratureGameStatus.CREATED;

		await db.literature().get( game.id ).update( game.serialize() ).run( ctx.connection );
		return game;
	};
}