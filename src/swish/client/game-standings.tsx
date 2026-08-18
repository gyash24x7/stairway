"use client";

import { cn } from "@/shared/ui/utils/cn.ts";
import { StandingsTable } from "@/swish/client/standings-table.tsx";

import type { StandingsColumn, StandingsRow } from "@/swish/client/standings-table.tsx";
import type {
	PlayerId,
	Roster,
	Standing,
	Standings,
	TeamId,
	TeamName
} from "@/swish/shared/schema.ts";

export type GameStandingsProps = {
	results?: Standings;
	players: Roster;
	teamNames?: Record<TeamId, TeamName>;
	playerId?: PlayerId;
	scoreLabel?: string;
	large?: boolean;
	className?: string;
};

type FinalRow = StandingsRow & { score?: number };

/**
 * Builds the headline above the table from the standings alone.
 *
 * `winner` is only ever an *outright* winner, so its absence is meaningful: the
 * rank-1 group is read instead. A whole team sharing first place is that team's
 * win (fish), several unrelated seats sharing it is a draw, and a lone seat that
 * still wasn't crowned is a solo game that ended unwon (wordle).
 *
 * @param results - The final standings.
 * @param leaders - Every standing at rank 1.
 * @param nameOf - Resolves a player id to a display name.
 * @param teamOf - Resolves name of the team
 * @param playerId - The viewing player, if any.
 * @returns The headline text.
 */
const headlineFor = (
	results: Standings,
	leaders: ReadonlyArray<Standing>,
	nameOf: ( id: PlayerId ) => string,
	teamOf: ( id: TeamId ) => string,
	playerId?: PlayerId
) => {
	if ( results.winner ) {
		return results.winner === playerId ? "You won!" : `${ nameOf( results.winner ) } won!`;
	}

	const leadTeam = leaders[ 0 ]?.team;
	if ( leadTeam && leaders.every( ( s ) => s.team === leadTeam ) ) {
		return `${ teamOf( leadTeam ) } won!`;
	}

	return leaders.length > 1 ? "It's a draw!" : "Better luck next time!";
};

/**
 * The end-of-game standings every game shows once it completes: a headline and
 * the final placement, straight from the engine's `resolveResults`. Renders
 * nothing until `results` arrives, so it is safe to mount unconditionally.
 *
 * Columns adapt to what the game actually reported — the rank column is dropped
 * for a single-seat game, and the team and score columns only appear when some
 * standing carries them.
 */
export function GameStandings( props: GameStandingsProps ) {
	const ranking = props.results?.ranking ?? [];
	if ( !props.results || ranking.length === 0 ) {
		return null;
	}

	const nameOf = ( id: PlayerId ) => props.players[ id ]?.name ?? id;
	const teamOf = ( id: TeamId ) => props.teamNames?.[ id ] ?? id;
	const leaders = ranking.filter( ( standing ) => standing.rank === 1 );
	const headline = headlineFor( props.results, leaders, nameOf, teamOf, props.playerId );

	const showRank = ranking.length > 1;
	const showTeam = ranking.some( ( standing ) => standing.team !== undefined );
	const showScore = ranking.some( ( standing ) => standing.score !== undefined );

	const rows: FinalRow[] = ranking.toSorted( ( a, b ) => a.rank - b.rank ).map( ( standing ) => ( {
		playerId: standing.playerId,
		rank: showRank ? standing.rank : undefined,
		isMe: standing.playerId === props.playerId,
		highlight: standing.rank === 1,
		score: standing.score,
		badge: showTeam && standing.team
			? (
				<span
					className={ cn(
						"shrink-0 rounded-sm bg-accent text-neutral-dark",
						"px-2 py-0.5 text-xs font-heading"
					) }
				>
					{ teamOf( standing.team ) }
				</span>
			)
			: undefined
	} ) );

	const columns: StandingsColumn<FinalRow>[] = showScore
		? [ {
			key: "score",
			label: props.scoreLabel ?? "SCORE",
			render: ( row ) => row.score ?? "—"
		} ]
		: [];

	return (
		<StandingsTable
			rows={ rows }
			columns={ columns }
			players={ props.players }
			headline={ headline }
			large={ props.large }
			className={ props.className }
		/>
	);
}
