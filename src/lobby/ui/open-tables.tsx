import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { cn } from "cn";
import { RefreshCwIcon } from "lucide-react";
import { Link } from "react-router";

import { useAuth } from "@/auth/ui/use-auth";
import type { OpenTable } from "@/lobby/schema";
import { ALL_GAMES, openTablesAtom } from "@/lobby/ui/client";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { errorMessage } from "@/shared/shell/errors";
import { PlayerId } from "@/swish/schema";
import { useGamePath } from "@/swish/ui/game-path";
import { RPlayerInfoSmall } from "@/swish/ui/player-info";


export type OpenTablesProps = {
	/** Narrows the list to one game. Absent lists every game. */
	game?: string;
	className?: string;
};

/** The link that both the shared invite and this button point at. */

type OpenTableRowProps = {
	table: OpenTable;
	showGame: boolean;
	/** Whether the person reading this already holds a seat at this table. */
	mine: boolean;
};

/**
 * One table, as a row somebody decides about in a second: how full it is, who
 * is already there, and the way in.
 *
 * JOIN is a link to the join page rather than a button that seats you, and that
 * is deliberate — it is the same URL the creator copies and shares, so the two
 * ways of being invited land on exactly the same confirmation instead of one
 * silently taking a seat and the other asking first.
 *
 * The caller's own table gets OPEN instead, straight to the table. The seat is
 * already theirs, so there is nothing to confirm; sending them through the join
 * page would only bounce them off its "you are already here" redirect.
 */
function OpenTableRow( { table, showGame, mine }: OpenTableRowProps ) {
	const path = useGamePath();
	return (
		<li
			className={ cn(
				"flex gap-3 items-center rounded-md bg-surface border-2 border-outline",
				"px-3 py-2 flex-wrap"
			) }
		>
			<div className={ "flex flex-col min-w-0" }>
				{ showGame && (
					<span className={ "font-heading text-sm" }>{ table.game.toUpperCase() }</span>
				) }
				<span className={ "text-xs text-muted-foreground" }>
					{ `${ table.seated }/${ table.playerCount } SEATED` }
				</span>
				{ mine && (
					<span className={ "text-xs text-muted-foreground" }>YOUR TABLE</span>
				) }
			</div>
			<div className={ "flex flex-1 flex-wrap items-center min-w-0" }>
				{ table.players.map( player => (
					<RPlayerInfoSmall key={ player.id } player={ player }/>
				) ) }
			</div>
			<Link
				to={ mine
					? path( table.game, table.gameId )
					: path( table.game, table.gameId, "join" ) }
				className={ "ml-auto" }
			>
				<Button size={ "sm" } variant={ mine ? "neutral" : "default" }>
					{ mine ? "OPEN" : "JOIN" }
				</Button>
			</Link>
		</li>
	);
}

/**
 * The lobby: tables anybody may sit down at.
 *
 * What it lists is narrower than "games that have not started", and each
 * exclusion is a decision made server-side: private tables are never offered,
 * tables the caller already sits at are dropped, and tables older than the hot
 * store's TTL are gone because the game behind them is. So an empty list here
 * means there is genuinely nothing to join, and the copy says so plainly rather
 * than implying something failed.
 *
 * It is mounted by `GameHomePage` for one game and by `/tables` for all of
 * them, which is the only thing `game` changes.
 */
export function OpenTables( { game, className }: OpenTablesProps ) {
	const atom = openTablesAtom( game ?? ALL_GAMES );
	const result = useAtomValue( atom );
	const refresh = useAtomRefresh( atom );
	const me = useAuth();

	const tables = AsyncResult.isSuccess( result ) ? result.value : undefined;

	return (
		<div
			className={ cn(
				"rounded-md bg-background p-6 flex flex-col gap-4 flex-1 max-w-2xl",
				className
			) }
		>
			<div className={ "flex gap-2 items-center justify-between" }>
				<h2 className={ "text-xl font-heading" }>Open Tables</h2>
				<Button
					size={ "icon" }
					variant={ "neutral" }
					onClick={ refresh }
					disabled={ result.waiting }
					title={ "Refresh the list" }
				>
					<RefreshCwIcon className={ "w-4 h-4" }/>
				</Button>
			</div>
			<p className={ "text-sm text-muted-foreground" }>
				Tables waiting for players. Take a seat at any of them.
			</p>

			{ result.waiting && !tables && (
				<div className={ "flex justify-center py-6" }><Spinner/></div>
			) }

			{ AsyncResult.isFailure( result ) && (
				<p className={ "text-sm text-foreground" }>
					{ errorMessage( Option.getOrUndefined( AsyncResult.error( result ) ) ) }
				</p>
			) }

			{ !!tables && tables.length === 0 && (
				<p className={ "text-sm text-muted-foreground" }>
					No open tables right now. Create one and share the link.
				</p>
			) }

			{ !!tables && tables.length > 0 && (
				<ul className={ "flex flex-col gap-2" }>
					{ tables.map( table => (
						<OpenTableRow
							key={ table.gameId }
							table={ table }
							showGame={ game === undefined }
							mine={ !!me && table.players.some(
								player => player.id === PlayerId.make( me.id )
							) }
						/>
					) ) }
				</ul>
			) }
		</div>
	);
}
