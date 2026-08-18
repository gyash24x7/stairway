import {
	InvalidTeamConfig,
	NotOnTeam,
	TeamAlreadyNamed,
	TeamFull,
	TeamNotFound,
	TeamsUnavailable
} from "@/swish/shared/schema.ts";

import type {
	BaseGameConfig,
	GameContext,
	PlayerId,
	Standing,
	Standings,
	TeamId,
	TeamStanding
} from "@/swish/shared/schema.ts";

/**
 * What a side calls itself, if it named itself at all. A side is named at most
 * once, so this never changes once it answers.
 *
 * @param context - The context holding the names.
 * @param team - The side being looked up.
 * @returns Its chosen name, or `undefined` when it never chose one.
 */
export const nameOf = ( context: GameContext, team: TeamId ) => context.teamNames[ team ];

/**
 * How many seats each side holds. Sides are equal-sized, which `initialize`
 * enforces, so this divides evenly for any config that reached storage.
 *
 * @param config - The game config declaring the sides.
 * @returns Seats per side, or `undefined` when the game has no teams.
 */
export const teamSize = ( config: BaseGameConfig ) =>
	config.teams ? config.playerCount / config.teams.length : undefined;

/**
 * The side a player is on.
 * @param context - The context holding membership.
 * @param playerId - The player being looked up.
 * @returns Their team, or `undefined` when they hold none.
 */
export const teamOf = ( context: GameContext, playerId: PlayerId ) => context.teams[ playerId ];

/**
 * Everyone on a side, in seat order.
 * @param context - The context holding membership and the seating order.
 * @param team - The side being listed.
 * @returns That side's players, ordered as they are seated.
 */
export const membersOf = ( context: GameContext, team: TeamId ) =>
	context.players.filter( playerId => teamOf( context, playerId ) === team );

/**
 * Whether two players are on the same side. Two players who both hold no side are
 * not teammates — an unassigned seat has no partners, it has no team at all.
 *
 * @param context - The context holding membership.
 * @param playerId - The first player.
 * @param other - The second player.
 * @returns `true` when both hold the same team.
 */
export const areTeammates = ( context: GameContext, playerId: PlayerId, other: PlayerId ) => {
	const team = teamOf( context, playerId );
	return team !== undefined && team === teamOf( context, other );
};

/**
 * Everyone playing alongside a player, in seat order — the player themselves
 * excluded.
 *
 * Returns nothing in a game without teams: a seat holding no side has no
 * partners, and two seats holding none are not teammates. `areTeammates` draws
 * the same line, and this is its list form.
 *
 * @param context - The context holding membership and the seating order.
 * @param playerId - The player whose teammates are wanted.
 * @returns The other players on that player's side.
 */
export const teamMatesOf = ( context: GameContext, playerId: PlayerId ) => {
	const team = teamOf( context, playerId );
	return team === undefined
		? []
		: context.players.filter(
			other => other !== playerId && teamOf( context, other ) === team
		);
};

/**
 * Everyone playing against a player, in seat order. This is what a move's
 * `execute` builds an interaction frame's `responders` from when a side reacts as
 * a group: the frame itself stays a plain list of players.
 *
 * Returns nothing in a game without teams, where no seat opposes another by side.
 *
 * @param context - The context holding membership and the seating order.
 * @param playerId - The player whose opponents are wanted.
 * @returns The players not on that player's side.
 */
export const opponentsOf = ( context: GameContext, playerId: PlayerId ) => {
	const team = teamOf( context, playerId );
	return team === undefined
		? []
		: context.players.filter(
			other => other !== playerId && teamOf( context, other ) !== team
		);
};

/**
 * Checks a config's teams can actually be seated: at least two sides, no repeats,
 * and a `playerCount` that splits evenly between them. Returns the failure rather
 * than raising it, the way a move's `validate` does.
 *
 * @param config - The config being created with.
 * @returns The reason it cannot be seated, or `undefined` when it can.
 */
export const validateTeamConfig = ( config: BaseGameConfig ) => {
	const teams = config.teams;
	if ( !teams ) {
		return undefined;
	}

	if ( teams.length < 2 ) {
		return new InvalidTeamConfig( {
			reason: `A team game needs at least two sides, got ${ teams.length }.`
		} );
	}

	if ( new Set( teams ).size !== teams.length ) {
		return new InvalidTeamConfig( { reason: "Team ids must be unique." } );
	}

	if ( config.playerCount % teams.length !== 0 ) {
		return new InvalidTeamConfig( {
			reason: `${ config.playerCount } seats do not split evenly between ${ teams.length } sides.`
		} );
	}

	return undefined;
};

/**
 * Fills every seat that picked no side, dropping each into the emptiest one and
 * breaking ties by the order the config lists them.
 *
 * Reads the seating order array rather than the roster's keys, deliberately: the
 * roster is a record round-tripped through structured clone, so a numeric-looking
 * player id would sort to the front of its key order and the balance would differ
 * between the original run and a rebuild from the log.
 *
 * @param teams - The sides the config declares, in order.
 * @param players - The seated players, in the order they joined.
 * @param assigned - The sides already picked in the lobby.
 * @returns A side for every seated player.
 */
export const balanceTeams = (
	teams: ReadonlyArray<TeamId>,
	players: ReadonlyArray<PlayerId>,
	assigned: GameContext[ "teams" ]
) => {
	const counts = new Map( teams.map( team => [ team, 0 ] ) );
	const result: Record<PlayerId, TeamId> = {};

	for ( const playerId of players ) {
		const team = assigned[ playerId ];
		if ( team !== undefined && counts.has( team ) ) {
			result[ playerId ] = team;
			counts.set( team, ( counts.get( team ) ?? 0 ) + 1 );
		}
	}

	for ( const playerId of players ) {
		if ( result[ playerId ] !== undefined ) {
			continue;
		}

		const pick = teams.reduce(
			( emptiest, team ) =>
				( counts.get( team ) ?? 0 ) < ( counts.get( emptiest ) ?? 0 ) ? team : emptiest
		);

		result[ playerId ] = pick;
		counts.set( pick, ( counts.get( pick ) ?? 0 ) + 1 );
	}

	return result;
};

/**
 * Seats the sides so they alternate — `red[0], blue[0], red[1], blue[1], …` —
 * which is what makes the engine's default round-robin hand the turn to the other
 * side each time.
 *
 * It works by re-arranging the seating order it is given rather than rebuilding
 * one from the config, so the result is a permutation of its input by
 * construction. That is load-bearing: the reducer that applies the resulting event
 * cannot reject a bad order, and a seat missing from it would be served the table
 * view instead of its own, silently. Any seat holding no side keeps its place at
 * the back rather than being dropped.
 *
 * The side of whoever currently sits first leads, so the creator keeps the opening
 * turn in the ordinary case.
 *
 * @param teams - The sides the config declares, in order.
 * @param players - The seated players, in the order they joined.
 * @param assigned - The side every seat is on.
 * @returns The interleaved seating order.
 */
export const interleaveSeats = (
	teams: ReadonlyArray<TeamId>,
	players: ReadonlyArray<PlayerId>,
	assigned: Record<PlayerId, TeamId>
) => {
	const buckets = teams.map(
		team => players.filter( playerId => assigned[ playerId ] === team )
	);

	const seatless = players.filter(
		playerId => !teams.includes( assigned[ playerId ] as TeamId )
	);

	const first = players[ 0 ];
	const lead = first === undefined ? -1 : teams.indexOf( assigned[ first ] as TeamId );
	const rotated = lead > 0
		? [ ...buckets.slice( lead ), ...buckets.slice( 0, lead ) ]
		: buckets;

	const order: Array<PlayerId> = [];
	const deepest = rotated.reduce( ( depth, bucket ) => Math.max( depth, bucket.length ), 0 );

	for ( let index = 0; index < deepest; index++ ) {
		for ( const bucket of rotated ) {
			const playerId = bucket[ index ];
			if ( playerId !== undefined ) {
				order.push( playerId );
			}
		}
	}

	return [ ...order, ...seatless ];
};

/**
 * Whether a player may take a side: the game has to declare teams, the side
 * has to be one of them, and it has to have room. Returns the refusal rather
 * than raising it, so `join` and `joinTeam` refuse a pick for the same reasons.
 *
 * @param game - The game name
 * @param config - The game config
 * @param context - The game context
 * @param playerId - The player taking the side.
 * @param team - The side being taken.
 * @returns Why the side cannot be taken, or `undefined` when it can.
 */
export const refuseTeam = (
	game: string,
	config: BaseGameConfig,
	context: GameContext,
	playerId: PlayerId,
	team: TeamId
) => {
	const teams = config.teams;
	if ( !teams ) {
		return new TeamsUnavailable( { game } );
	}

	if ( !teams.includes( team ) ) {
		return new TeamNotFound( { team } );
	}

	const size = teamSize( config ) ?? 0;
	const taken = membersOf( context, team )
		.filter( seated => seated !== playerId )
		.length;

	if ( taken >= size ) {
		return new TeamFull( { team, size } );
	}

	return undefined;
};


/**
 * Whether a player may name a side: the game has to declare teams, the side has
 * to be one of them, the player has to be playing on it, and it must not already
 * have a name. Returns the refusal rather than raising it, the way `refuseTeam`
 * does.
 *
 * A name is chosen once and never edited, so the last check is what makes the
 * first caller on a side the one who names it — and what stops a teammate
 * overwriting it afterwards.
 *
 * @param game - The game's name, for the error that says it has no sides.
 * @param config - The config declaring the sides.
 * @param context - The context holding membership and the names.
 * @param playerId - The player naming the side.
 * @param team - The side being named.
 * @returns Why it cannot be named, or `undefined` when it can.
 */
export const refuseName = (
	game: string,
	config: BaseGameConfig,
	context: GameContext,
	playerId: PlayerId,
	team: TeamId
) => {
	const teams = config.teams;
	if ( !teams ) {
		return new TeamsUnavailable( { game } );
	}

	if ( !teams.includes( team ) ) {
		return new TeamNotFound( { team } );
	}

	if ( teamOf( context, playerId ) !== team ) {
		return new NotOnTeam( { playerId, team } );
	}

	const named = nameOf( context, team );
	if ( named !== undefined ) {
		return new TeamAlreadyNamed( { team, name: named } );
	}

	return undefined;
};


/**
 * Adds what a team game's standings owe to the sides rather than the seats:
 * every player stamped with theirs, and a per-side ranking compiled from the
 * result. A game may resolve its own sides, and then this leaves them alone.
 *
 * The stamping happens here rather than being left to `resolveResults`
 * because the engine owns teams, and it happens *before* the event is built
 * so the aggregate lands in the payload — otherwise changing how sides are
 * ranked would rewrite finished games the next time they were rebuilt.
 *
 * `winner` names one player, which a side winning together cannot, so a team
 * game leaves it unset and answers with `winningTeam`.
 *
 * @param results - The standings the game resolved.
 * @param context - The context holding membership.
 * @param teams - The sides the config declares.
 * @returns The standings, with the sides filled in.
 */
export const withTeamStandings = (
	results: Standings,
	context: GameContext,
	teams: ReadonlyArray<TeamId>
) => {
	const ranking = results.ranking.map( standing => ( {
		...standing,
		team: standing.team ?? teamOf( context, standing.playerId )
	} ) );

	if ( results.teamRanking ) {
		return { ...results, ranking };
	}

	const { teamRanking, winningTeam } = rankTeams( teams, ranking );

	return {
		...results,
		ranking,
		teamRanking,
		...( results.winningTeam ? {} : { winningTeam } )
	};
};

/**
 * Compiles per-side standings out of the per-player ones a game resolved.
 *
 * Sides are ranked by their total score when the game scores at all, and by their
 * best player's rank when it does not — which is what lets a game that only
 * decides a winner still report which side won. Ranking is competition-style, so
 * equal sides share a rank, and a tie at the top leaves the game drawn with no
 * winning side.
 *
 * @param teams - The sides the config declares, in order.
 * @param ranking - The player standings, each already stamped with its side.
 * @returns The side standings and the winning side, if there is one.
 */
export const rankTeams = ( teams: ReadonlyArray<TeamId>, ranking: ReadonlyArray<Standing> ) => {
	const scored = ranking.some( standing => standing.score !== undefined );

	const totals = teams
		.map( team => {
			const members = ranking.filter( standing => standing.team === team );
			const score = scored
				? members.reduce( ( sum, standing ) => sum + ( standing.score ?? 0 ), 0 )
				: -members.reduce( ( best, standing ) => Math.min( best, standing.rank ), Infinity );

			return { team, score };
		} )
		.sort( ( a, b ) => b.score - a.score );

	const teamRanking: Array<TeamStanding> = totals.map( entry => ( {
		team: entry.team,
		rank: totals.findIndex( other => other.score === entry.score ) + 1,
		...( scored ? { score: entry.score } : {} )
	} ) );

	const [ top, runnerUp ] = totals;
	const winningTeam = top && top.score !== runnerUp?.score ? top.team : undefined;

	return { teamRanking, winningTeam };
};
