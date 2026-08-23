import { nameOf, teamOf } from "@/swish/shared/teams.ts";

import type {
	BaseGameConfig,
	GameContext,
	PlayerId,
	PlayerInfo,
	Roster,
	TeamId,
	TeamName
} from "@/swish/shared/schema.ts";

/**
 * The finished game a rematch is built from — everything about it the next one
 * needs, and nothing else. Deliberately structural rather than a `GameView`:
 * this is the whole input to the decision, and naming exactly the three fields
 * it reads is what keeps the plan testable without a game to build it from.
 */
export type RematchSource = {
	readonly players: Roster;
	readonly context: GameContext;
	readonly config: BaseGameConfig;
};

/**
 * What the next game is made of: who sits at it, in what order, on which side,
 * and what those sides call themselves.
 *
 * Every field is a list rather than a record because the engine takes them one
 * command at a time and the order it takes them in matters — seats are dealt in
 * this order, and a side is named by someone already on it.
 */
export type RematchPlan = {
	readonly players: ReadonlyArray<PlayerInfo>;
	readonly teams: ReadonlyArray<{ readonly playerId: PlayerId; readonly team: TeamId }>;
	readonly teamNames: ReadonlyArray<{
		readonly team: TeamId;
		readonly name: TeamName;
		readonly by: PlayerId;
	}>;
};

/**
 * Works out the next game from the one that just finished.
 *
 * Pure, and the only place a rematch decides anything: the handler that builds
 * the new table is a loop over what this returns. That split is deliberate —
 * seating a table touches the database, two Durable Objects and half a dozen
 * engine commands, none of which can be tested here, while every rule worth
 * getting right is in this function.
 *
 * Seats are read from `context.players` rather than the roster's keys, because
 * that array is the seating *order* — in a team game the interleaved one
 * `SeatOrderSet` wrote — and because a roster round-tripped through structured
 * clone does not promise its key order back. The same table means the same
 * chairs, so the order is replayed as it stood.
 *
 * Bots are carried across whole rather than re-minted. `addBots` would generate
 * fresh ids, names and avatars, and a rematch against "the same bots" that
 * quietly swaps them for strangers is not the thing anyone asked for.
 *
 * Sides are only carried when asked for. When they are not, nothing is
 * assigned and nothing is named: a name belongs to the people who chose it and
 * played under it, so a table that has just dissolved its sides starts naming
 * them over. Whoever then picks nothing is balanced in at `start`.
 *
 * @param source - The finished game's roster, context and config.
 * @param keepTeams - Whether to seat everyone back on the side they just played.
 * @returns The seats, sides and names the next game is built from.
 */
export const planRematch = ( source: RematchSource, keepTeams: boolean ) => {
	const players = source.context.players
		.map( playerId => source.players[ playerId ] )
		.filter( ( player ): player is PlayerInfo => player !== undefined );

	const sides = source.config.teams;
	if ( !keepTeams || !sides ) {
		return { players, teams: [], teamNames: [] } satisfies RematchPlan;
	}

	const teams = players
		.map( player => ( { playerId: player.id, team: teamOf( source.context, player.id ) } ) )
		.filter( (
			seat
		): seat is { playerId: PlayerId; team: TeamId } =>
			seat.team !== undefined && sides.includes( seat.team ) );

	const teamNames = sides
		.map( team => ( {
			team,
			name: nameOf( source.context, team ),
			by: teams.find( seat => seat.team === team )?.playerId
		} ) )
		.filter( (
			named
		): named is { team: TeamId; name: TeamName; by: PlayerId } =>
			named.name !== undefined && named.by !== undefined );

	return { players, teams, teamNames } satisfies RematchPlan;
};
