import type { LitResolver } from "../types";
import { Messages } from "../constants"
import type { CreateTeamsInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";
import { LitGameStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";

function shuffle<T>( array: T[] ) {
	let arr = [ ...array ];
	for ( let i = arr.length; i > 1; i-- ) {
		let j = Math.floor( Math.random() * i );
		[ arr[ i - 1 ], arr[ j ] ] = [ arr[ j ], arr[ i - 1 ] ];
	}
	return arr;
}

function splitArray<T>( arr: T[] ) {
	return [ arr.slice( 0, arr.length / 2 ), arr.slice( arr.length / 2 ) ];
}

const createTeamsResolver: LitResolver<CreateTeamsInput> = async ( { input, ctx } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	if ( game.status !== LitGameStatus.PLAYERS_READY ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	if ( game.players.length !== game.playerCount ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NOT_ENOUGH_PLAYERS } );
	}

	const playerGroups = splitArray( shuffle( game.players ) );

	await ctx.prisma.litGame.update( {
		where: { id: game.id },
		data: { status: LitGameStatus.TEAMS_CREATED }
	} );

	game.status = LitGameStatus.TEAMS_CREATED;

	const teams = await Promise.all( input.teams.map( ( teamName, i ) =>
		ctx.prisma.litTeam.create( {
			data: {
				name: teamName,
				gameId: input.gameId,
				players: {
					connect: playerGroups[ i ].map( player => (
						{ id: player.id }
					) )
				}
			}
		} ) )
	);

	game.addTeams( teams, playerGroups );

	ctx.litGamePublisher?.publish( game );
	return game;
};

export default createTeamsResolver;