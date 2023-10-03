import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import type { AggregatedGameData, PlayerSpecificGameData } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import type { PlayingCard } from "@s2h/cards";

export class AggregateGameQuery implements IQuery {
	constructor(
		public readonly currentGame: AggregatedGameData,
		public readonly authInfo: UserAuthInfo
	) {}
}

@QueryHandler( AggregateGameQuery )
export class AggregateGameQueryHandler implements IQueryHandler<AggregateGameQuery, PlayerSpecificGameData> {

	async execute( { currentGame, authInfo }: AggregateGameQuery ) {
		const { teams, teamList, playerList, hands, cardMappings, ...rest } = currentGame;
		const currentPlayer = rest.players[ authInfo.id ];

		const currentPlayerTeam = !!currentPlayer.teamId ? teams[ currentPlayer.teamId ] : undefined;
		const currentPlayerTeamMembers = !!currentPlayerTeam
			? playerList
				.filter( player => player.teamId === currentPlayer.teamId )
				.map( player => player.id )
			: [];

		const oppositeTeam = !currentPlayer.teamId ? undefined : teamList.find( team => team.id !==
			currentPlayer.teamId );
		const oppositeTeamMembers = !!oppositeTeam
			? playerList
				.filter( player => player.teamId === currentPlayer.teamId )
				.map( player => player.id )
			: [];

		const hand: PlayingCard[] = hands[ currentPlayer.id ];
		const cardCounts: Record<string, number> = {};
		for ( const playerId in hands ) {
			cardCounts[ playerId ] = hands[ playerId ].length;
		}

		return {
			...rest,
			myTeam: !currentPlayerTeam ? undefined : { ...currentPlayerTeam, members: currentPlayerTeamMembers },
			oppositeTeam: !oppositeTeam ? undefined : { ...oppositeTeam, members: oppositeTeamMembers },
			hand,
			cardCounts
		};
	}
}