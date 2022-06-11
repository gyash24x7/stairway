import type { LitResolver } from "@s2h/utils";
import { Messages } from "@s2h/utils";
import type { JoinGameInput } from "@s2h/literature/dtos";
import { LitGameStatus, User } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { EnhancedLitGame } from "@s2h/literature/utils";

const joinGameResolver: LitResolver<JoinGameInput> = async ( { ctx, input } ) => {
	const user = ctx.res?.locals[ "user" ] as User;

	const game = await ctx.prisma.litGame.findFirst( {
		where: { code: input.code },
		include: { players: true }
	} );

	if ( !game ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	const userAlreadyInGame = !!game.players.find( player => player.userId === user.id );
	if ( userAlreadyInGame ) {
		return EnhancedLitGame.from( { ...game, moves: [], teams: [] } );
	}

	if ( game.players.length >= game.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_CAPACITY_FULL } );
	}

	const updatedGame = await ctx.prisma.litGame.update( {
		include: { players: true },
		where: { id: game.id },
		data: {
			status: game.players.length === game.playerCount - 1
				? LitGameStatus.PLAYERS_READY
				: LitGameStatus.NOT_STARTED,
			players: {
				create: { name: user.name, avatar: user.avatar, userId: user.id, hand: [] }
			}
		}
	} );

	const enhancedLitGame = EnhancedLitGame.from( { ...updatedGame, moves: [], teams: [] } );
	ctx.litGamePublisher?.publish( enhancedLitGame );
	return enhancedLitGame;
};

export default joinGameResolver;