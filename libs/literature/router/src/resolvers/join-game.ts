import type { JoinGameInput } from "@s2h/literature/dtos";
import { ILiteratureGame, LiteratureGame, LiteratureGameStatus, LiteraturePlayer } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

async function validate( ctx: LitTrpcContext, input: JoinGameInput ) {
	const [ game ] = await ctx.literatureTable.filter( { code: input.code } ).run( ctx.connection );

	if ( !game ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	if ( Object.keys( game.players ).length >= game.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_CAPACITY_FULL } );
	}

	return [ LiteratureGame.from( game ) ] as const;
}

export async function joinGame( { ctx, input }: LitResolverOptions<JoinGameInput> ): Promise<ILiteratureGame> {
	const [ game ] = await validate( ctx, input );
	const { id, name, avatar } = ctx.loggedInUser!;

	if ( game.isUserAlreadyInGame( id ) ) {
		return game;
	}

	game.addPlayer( LiteraturePlayer.from( { id, name, avatar } ) );

	game.status = Object.keys( game.players ).length === game.playerCount
		? LiteratureGameStatus.PLAYERS_READY
		: LiteratureGameStatus.CREATED;

	await ctx.literatureTable.get( game.id ).update( game.serialize() ).run( ctx.connection );
	ctx.litGamePublisher.publish( game );

	return game;
}