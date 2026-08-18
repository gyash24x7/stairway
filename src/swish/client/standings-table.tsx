"use client";

import { motion } from "framer-motion";
import { TrophyIcon } from "lucide-react";

import type { ReactNode } from "react";

import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { slideInUp, staggerContainer } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { PlayerId, Roster } from "@/swish/shared/schema.ts";

export type StandingsColumn<T> = {
	key: string;
	label: string;
	/** Width of the column, as a pair of classes for the page and the television. */
	width?: { base: string; large: string };
	render: ( row: T ) => ReactNode;
};

export type StandingsRow = {
	playerId: PlayerId;
	/** Omitted for a live table, which has no settled placement to show. */
	rank?: number;
	isMe?: boolean;
	/** Fills the row with accent — first place, or the current leader. */
	highlight?: boolean;
	/** A chip after the name, e.g. the side a seat is playing for. */
	badge?: ReactNode;
	/** Icons after the name, e.g. solved / gave up. */
	trailing?: ReactNode;
};

export type StandingsTableProps<T extends StandingsRow> = {
	rows: ReadonlyArray<T>;
	columns: ReadonlyArray<StandingsColumn<T>>;
	players: Roster;
	/** The banner above the table. A live table usually has none. */
	headline?: string;
	/** Television sizing — readable from across a room. */
	large?: boolean;
	className?: string;
};

const DEFAULT_WIDTH = { base: "w-20", large: "w-40" };

/**
 * A table of seats and their figures.
 *
 * This is the chrome behind both the end-of-game standings and wordle's live
 * duel scoreboard, which had grown into two implementations of one design — same
 * header strip, same hard-bordered rows, same accent left-edge marking your own
 * seat. Columns are supplied by the caller so a live table can show working
 * figures and a final one a settled score, without the two drifting apart.
 */
export function StandingsTable<T extends StandingsRow>( props: StandingsTableProps<T> ) {
	const { rows, columns, players, headline, large, className } = props;

	if ( rows.length === 0 ) {
		return null;
	}

	const showRank = rows.some( ( row ) => row.rank !== undefined );

	return (
		<div
			className={ cn(
				"w-full rounded-md bg-background border-2 border-outline overflow-hidden",
				"flex flex-col",
				className
			) }
		>
			{ !!headline && (
				<div className={ cn( "bg-accent text-neutral-dark p-3 text-center", large && "p-6" ) }>
					<p className={ cn( "text-2xl md:text-3xl font-heading", large && "text-6xl" ) }>
						{ headline }
					</p>
				</div>
			) }

			<div
				className={ cn(
					"flex items-center gap-3 px-3 py-1 border-t-2 border-outline bg-surface",
					"text-xs text-muted-foreground",
					large && "px-8 py-3 gap-6 text-2xl tracking-widest"
				) }
			>
				{ showRank && <span className={ cn( "w-10 shrink-0", large && "w-24" ) }>RANK</span> }
				<span className={ "flex-1 min-w-0" }>PLAYER</span>
				{ columns.map( ( column ) => (
					<span
						key={ column.key }
						className={ cn(
							"shrink-0 text-right",
							large ? column.width?.large ?? DEFAULT_WIDTH.large
								: column.width?.base ?? DEFAULT_WIDTH.base
						) }
					>
						{ column.label }
					</span>
				) ) }
			</div>

			<motion.ul
				className={ cn( "flex flex-col", large && "flex-1 min-h-0" ) }
				variants={ staggerContainer }
				initial={ "initial" }
				animate={ "animate" }
			>
				{ rows.map( ( row ) => {
					const player = players[ row.playerId ];

					return (
						<motion.li
							key={ row.playerId }
							layout
							variants={ slideInUp }
							className={ cn(
								"flex items-center gap-3 px-3 py-2 border-t-2 border-outline",
								row.highlight && "bg-accent text-neutral-dark",
								row.isMe && "border-l-4 border-l-accent",
								row.isMe && row.highlight && "border-l-foreground",
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
									{ row.rank === 1 && (
										<TrophyIcon className={ cn( "w-4 h-4 shrink-0", large && "w-10 h-10" ) }/>
									) }
									{ row.rank }
								</span>
							) }

							<span className={ cn( "flex-1 min-w-0 flex items-center gap-2", large && "gap-5" ) }>
								{ !!player && (
									<Avatar
										className={ cn(
											"rounded-full w-6 h-6 md:w-8 md:h-8 shrink-0",
											large && "w-20 h-20 md:w-20 md:h-20"
										) }
									>
										<AvatarImage src={ player.avatar } alt={ "" } className={ "bg-background" }/>
									</Avatar>
								) }
								<span className={ cn( "truncate text-sm md:text-base", large && "md:text-4xl" ) }>
									{ player?.name ?? row.playerId }
									{ row.isMe && (
										<span className={ cn( "text-xs ml-1", large && "text-2xl ml-3" ) }>(YOU)</span>
									) }
								</span>
								{ row.trailing }
								{ row.badge }
							</span>

							{ columns.map( ( column ) => (
								<span
									key={ column.key }
									className={ cn(
										"shrink-0 text-right text-lg font-heading",
										large ? cn( column.width?.large ?? DEFAULT_WIDTH.large, "text-5xl" )
											: column.width?.base ?? DEFAULT_WIDTH.base
									) }
								>
									{ column.render( row ) }
								</span>
							) ) }
						</motion.li>
					);
				} ) }
			</motion.ul>
		</div>
	);
}
