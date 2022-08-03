import type { LitResolverOptions, LitTrpcContext } from "../types";
import { Messages } from "../constants"
import type { CreateTeamsInput } from "@s2h/literature/dtos";
import { LitGameStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { shuffle } from "lodash";
import type { IEnhancedLitGame } from "@s2h/literature/utils";

function validate( ctx: LitTrpcContext ) {
	if ( ctx.currentGame!.status !== LitGameStatus.PLAYERS_READY ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	if ( ctx.currentGame!.players.length !== ctx.currentGame!.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NOT_ENOUGH_PLAYERS } );
	}

	return [ ctx.currentGame! ] as const;
}

export default async function ( { input, ctx }: LitResolverOptions<CreateTeamsInput> ): Promise<IEnhancedLitGame> {
	const [ game ] = validate( ctx );

	const teams = await Promise.all( input.teams.map( name =>
		ctx.prisma.litTeam.create( { data: { name, gameId: game.id } } )
	) );

	game.addTeams( teams );

	const players = await Promise.all(
		shuffle( game.players ).map( ( player, i ) =>
			ctx.prisma.litPlayer.update( {
				where: { id: player.id },
				data: { teamId: teams[ i % 2 ].id }
			} )
		)
	);

	game.handlePlayerUpdate( ...players );

	await ctx.prisma.litGame.update( {
		where: { id: game.id },
		data: { status: LitGameStatus.TEAMS_CREATED }
	} );

	game.status = LitGameStatus.TEAMS_CREATED;

	ctx.litGamePublisher.publish( game );
	return game;
};