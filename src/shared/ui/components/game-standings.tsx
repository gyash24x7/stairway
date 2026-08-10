"use client";

import { motion } from "framer-motion";
import { TrophyIcon } from "lucide-react";

import type { PlayerId, Players, Standing, Standings } from "@/shared/swish/schema.ts";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { slideInUp, staggerContainer } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

export type GameStandingsProps = {
	/** The engine's `snapshot.results` — absent until the game is `COMPLETED`. */
	results?: Standings;

	/** The roster, for resolving names and avatars. */
	players: Players;

	/** The viewing player, whose row is marked and whose win reads "You won!". */
	playerId?: PlayerId;

	/** What the score column counts ("POINTS", "BOOKS", …). Omit for scoreless games. */
	scoreLabel?: string;

	/**
	 * Television sizing — bigger type and rows that share the available height, so
	 * the table fills a couch screen instead of sitting tiny in the middle of it.
	 */
	large?: boolean;

	className?: string;
};

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
 * @param playerId - The viewing player, if any.
 * @returns The headline text.
 */
const headlineFor = (
	results: Standings,
	leaders: ReadonlyArray<Standing>,
	nameOf: ( id: PlayerId ) => string,
	playerId?: PlayerId
) => {
	if ( results.winner ) {
		return results.winner === playerId ? "You won!" : `${ nameOf( results.winner ) } won!`;
	}

	const leadTeam = leaders[ 0 ]?.team;
	if ( leadTeam && leaders.every( ( s ) => s.team === leadTeam ) ) {
		return `${ leadTeam } won!`;
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
	const leaders = ranking.filter( ( standing ) => standing.rank === 1 );
	const headline = headlineFor( props.results, leaders, nameOf, props.playerId );

	const showRank = ranking.length > 1;
	const showTeam = ranking.some( ( standing ) => standing.team !== undefined );
	const showScore = ranking.some( ( standing ) => standing.score !== undefined );

	const large = props.large;

	return (
		<div
			className={ cn(
				"w-full rounded-md bg-background border-2 border-black overflow-hidden",
				"flex flex-col",
				props.className
			) }
		>
			<div className={ cn( "bg-accent text-neutral-dark p-3 text-center", large && "p-6" ) }>
				<p className={ cn( "text-2xl md:text-3xl font-heading", large && "text-6xl" ) }>
					{ headline }
				</p>
			</div>

			<div
				className={ cn(
					"flex items-center gap-3 px-3 py-1 border-t-2 border-black bg-surface",
					"text-xs text-muted-foreground",
					large && "px-8 py-3 gap-6 text-2xl tracking-widest"
				) }
			>
				{ showRank && (
					<span className={ cn( "w-10 shrink-0", large && "w-24" ) }>RANK</span>
				) }
				<span className={ "flex-1 min-w-0" }>PLAYER</span>
				{ showScore && (
					<span className={ cn( "w-20 shrink-0 text-right", large && "w-40" ) }>
						{ props.scoreLabel ?? "SCORE" }
					</span>
				) }
			</div>

			<motion.ul
				className={ cn( "flex flex-col", large && "flex-1 min-h-0" ) }
				variants={ staggerContainer }
				initial={ "initial" }
				animate={ "animate" }
			>
				{ ranking.map( ( standing ) => {
					const player = props.players[ standing.playerId ];
					const isMe = standing.playerId === props.playerId;

					return (
						<motion.li
							key={ standing.playerId }
							variants={ slideInUp }
							className={ cn(
								"flex items-center gap-3 px-3 py-2 border-t-2 border-black",
								standing.rank === 1 && "bg-accent text-neutral-dark",
								isMe && "border-l-4 border-l-accent",
								isMe && standing.rank === 1 && "border-l-foreground",
								large && "flex-1 min-h-0 px-8 py-6 gap-6"
							) }
						>
							{ showRank && (
								<span
									className={ cn(
										"w-10 shrink-0 flex items-center gap-1 text-lg font-heading",
										large && "w-24 gap-3 text-5xl"
									) }
								>
									{ standing.rank === 1 && (
										<TrophyIcon
											className={ cn( "w-4 h-4 shrink-0", large && "w-10 h-10" ) }
										/>
									) }
									{ standing.rank }
								</span>
							) }

							<span
								className={ cn(
									"flex-1 min-w-0 flex items-center gap-2",
									large && "gap-5"
								) }
							>
								{ player && (
									<Avatar
										className={ cn(
											"rounded-full w-6 h-6 md:w-8 md:h-8 shrink-0",
											large && "w-20 h-20 md:w-20 md:h-20"
										) }
									>
										<AvatarImage
											src={ player.avatar }
											alt={ "" }
											className={ "bg-background" }
										/>
									</Avatar>
								) }
								<span className={ cn( "truncate text-sm md:text-base", large && "md:text-4xl" ) }>
									{ nameOf( standing.playerId ) }
									{ isMe && (
										<span className={ cn( "text-xs ml-1", large && "text-2xl ml-3" ) }>
											(YOU)
										</span>
									) }
								</span>
								{ showTeam && standing.team && (
									<span
										className={ cn(
											"shrink-0 rounded-sm bg-accent text-neutral-dark",
											"px-2 py-0.5 text-xs font-heading"
										) }
									>
										{ standing.team }
									</span>
								) }
							</span>

							{ showScore && (
								<span
									className={ cn(
										"w-20 shrink-0 text-right text-lg font-heading",
										large && "w-40 text-5xl"
									) }
								>
									{ standing.score ?? "—" }
								</span>
							) }
						</motion.li>
					);
				} ) }
			</motion.ul>
		</div>
	);
}
