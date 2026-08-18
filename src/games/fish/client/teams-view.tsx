"use client";

import { useFish } from "@/games/fish/client/context.tsx";
import { claimsOf, getTeamScores } from "@/games/fish/shared/utils.ts";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RPlayerInfoStrip } from "@/swish/client/player-info.tsx";
import { membersOf, nameOf, teamOf } from "@/swish/shared/teams.ts";

import type { PlayerId, TeamId } from "@/swish/shared/schema.ts";

function PlayerWithCardCount( props: { playerId: PlayerId } ) {
	const { data } = useFish();
	const player = data.players[ props.playerId ];
	const cardCount = data.view.cardCounts[ props.playerId ] ?? 0;
	const isActive = props.playerId === data.context.currentPlayer;

	return (
		<div
			className={ cn(
				"flex gap-1 md:gap-2 items-center rounded-md px-2 py-1",
				isActive && "bg-accent/20"
			) }
		>
			<RPlayerInfoStrip player={ player }/>
			<span
				className={ cn(
					"text-xs md:text-sm font-bold px-2 py-0.5 rounded-full",
					cardCount > 0 ? "bg-accent text-neutral-dark" : "bg-neutral-400 text-white"
				) }
			>
				{ cardCount }
			</span>
		</div>
	);
}

/**
 * Every side at the table, with its books.
 *
 * The scores are folded out of the declarations rather than read off the view:
 * every declaration takes its book out of play and `getBookWinner` says which
 * side it went to, so the same derivation the engine scores with runs here on
 * the same public history.
 */
export function TeamsView() {
	const { data } = useFish();

	const scores = getTeamScores( claimsOf( data.view ), data.context, data.config.teams );
	const myTeam = teamOf( data.context, data.view.playerId );

	const label = ( team: TeamId, index: number ) =>
		nameOf( data.context, team ) ?? `TEAM ${ index + 1 }`;

	return (
		<div className={ "grid grid-cols-1 gap-2 w-full" }>
			{ data.config.teams.map( ( team, index ) => (
				<div
					key={ team }
					className={ cn(
						"bg-background rounded-md p-2 md:p-3 flex flex-col gap-3",
						myTeam === team && "border-2 border-accent"
					) }
				>
					<div className={ "flex items-baseline justify-between" }>
						<div className={ "text-2xl md:text-4xl uppercase font-heading pr-16 truncate" }>
							{ label( team, index ) }
						</div>
						<div className={ "gap-3 flex-wrap flex-1 hidden md:flex" }>
							{ membersOf( data.context, team ).map( pid => (
								<PlayerWithCardCount playerId={ pid } key={ pid }/>
							) ) }
						</div>
						<div className={ "text-2xl md:text-4xl font-heading pl-8" }>
							{ scores[ team ] ?? 0 }
						</div>
					</div>
					<div className={ "md:hidden flex w-full gap-1 flex-wrap" }>
						{ membersOf( data.context, team ).map( pid => (
							<PlayerWithCardCount playerId={ pid } key={ pid }/>
						) ) }
					</div>
				</div>
			) ) }
		</div>
	);
}
