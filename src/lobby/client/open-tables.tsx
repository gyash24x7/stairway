import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { Login } from "@/auth/client/login.tsx";
import { listOpenTablesFn } from "@/lobby/client/client.ts";
import { GAME_CATALOG } from "@/lobby/client/game-catalog.ts";
import { OpenTableRow } from "@/lobby/client/open-table-row.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { JoinGameInput } from "@/swish/shared/schema.ts";

import type { OpenTable } from "@/lobby/shared/schema.ts";
import type { GameRef } from "@/swish/shared/schema.ts";

/**
 * The lobby's query key.
 *
 * Exported so the per-game section and the whole-arena page share one cache
 * entry per scope, and moving between them is instant rather than a refetch.
 */
export const openTablesKey = ( game?: string ) => [ "lobby", "listOpenTables", game ?? "all" ];

/** How often the list re-asks while somebody is looking at it. */
const REFRESH_INTERVAL_MS = 10_000;

export type OpenTablesProps = {
	isLoggedIn?: boolean;
	/** Narrow to one kind. Omitted, every kind is listed. */
	game?: string;
	/**
	 * That kind's join endpoint, when the caller already holds one. The per-game
	 * page does; the arena does not, and falls back to the catalog.
	 */
	joinGame?: ( input: JoinGameInput ) => Promise<GameRef>;
	title?: string;
};

/**
 * Tables anyone can sit down at.
 *
 * **Why this polls.** The app's query defaults switch off refetching on mount,
 * focus and reconnect, which is right for a game view because `useGameSync`
 * keeps it live from the game's own socket. There is no socket for a listing —
 * the channels are one per game id — so this is the one surface that has to ask,
 * and it overrides those defaults rather than inheriting a staleness policy that
 * assumed a push it does not get.
 *
 * **Why joining may fail.** The projection reaches the store over a queue, so a
 * table that has just filled can still be listed for a moment. Rather than try to
 * prevent that, the join is allowed to lose: `GameFull` and `GameNotJoinable` are
 * already part of every game's join contract, the global mutation handler toasts
 * whichever it was, and the list is invalidated so the row that lied corrects
 * itself immediately instead of at the next tick.
 *
 * There is deliberately no local error handler on the mutation — the app already
 * has one, and adding a second would report the same failure twice.
 */
export function OpenTables( props: OpenTablesProps ) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data, isLoading, isError, error, refetch, isFetching } = useQuery( {
		queryKey: openTablesKey( props.game ),
		queryFn: () => listOpenTablesFn( props.game ),
		refetchOnMount: "always",
		refetchOnWindowFocus: true,
		refetchInterval: REFRESH_INTERVAL_MS,
		staleTime: REFRESH_INTERVAL_MS / 2
	} );

	const joinTable = useMutation( {
		mutationFn: ( table: OpenTable ) => {
			const join = props.joinGame ?? GAME_CATALOG[ table.game ]?.join;

			if ( !join ) {
				throw new Error( `No client for ${ table.game }` );
			}

			return join( JoinGameInput.make( { code: table.code } ) );
		},
		onSuccess: ( ref, table ) => navigate( {
			to: `/${ table.game }/$gameId`,
			params: { gameId: ref.id }
		} ),
		onSettled: () => queryClient.invalidateQueries( { queryKey: [ "lobby" ] } )
	} );

	if ( !props.isLoggedIn ) {
		return (
			<div
				className={ cn(
					"rounded-md bg-background border-2 border-outline p-6",
					"flex flex-col gap-4 items-center text-center shadow-sm md:shadow-md"
				) }
			>
				<h3 className={ "text-xl font-heading" }>SIGN IN TO PLAY</h3>
				<p className={ "text-sm text-muted-foreground" }>
					You need an account to take a seat at an open table.
				</p>
				<Login/>
			</div>
		);
	}

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load open tables" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "BACK HOME", to: "/" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	const now = Date.now();

	return (
		<div className={ "flex flex-col gap-3 w-full max-w-6xl" }>
			<div className={ "flex items-center justify-between" }>
				<h2 className={ "text-4xl font-heading" }>{ props.title ?? "OPEN TABLES" }</h2>
				<Button
					size={ "icon" }
					variant={ "neutral" }
					onClick={ () => void refetch() }
					disabled={ isFetching }
					title={ "Refresh" }
				>
					<RefreshCwIcon className={ cn( "w-4 h-4 md:w-6 md:h-6", isFetching && "animate-spin" ) }/>
				</Button>
			</div>

			{ data.length === 0
				? (
					<div
						className={ cn(
							"rounded-md bg-background border-2 border-outline p-6",
							"flex flex-col gap-4 items-center text-center shadow-sm md:shadow-md"
						) }
					>
						<h3 className={ "text-xl font-heading" }>NO OPEN TABLES</h3>
						<p className={ "text-sm text-muted-foreground" }>
							{ props.game
								? "Nobody is waiting right now. Open one above and it will show up here."
								: "Nobody is waiting right now. Start a game and it will show up here." }
						</p>
						{ /* Only the arena sends people off to choose a game. On a game's own
						     page the create panel is a few inches above this, so a link away
						     would point at the page they are already on. */ }
						{ !props.game && (
							<Link to={ "/" }>
								<Button>PICK A GAME</Button>
							</Link>
						) }
					</div>
				)
				: (
					<div
						className={ cn(
							"w-full rounded-md bg-background border-2 border-outline overflow-hidden",
							"flex flex-col shadow-sm md:shadow-md"
						) }
					>
						<div
							className={ cn(
								"hidden md:flex items-center gap-3 px-3 py-1 bg-surface",
								"text-xs text-muted-foreground tracking-widest"
							) }
						>
							<span className={ "flex-1 min-w-0" }>GAME</span>
							<span className={ "w-24 shrink-0" }>CODE</span>
							<span className={ "w-32 shrink-0 text-right" }>SEATS</span>
							<span className={ "w-20 shrink-0 text-right" }>OPENED</span>
							<span className={ "w-16 shrink-0" }/>
						</div>

						{ data.map( table => {
							// The caller's own endpoint when it has one — the per-game page does —
							// and the catalog otherwise. A kind neither knows is shown but not
							// joinable, rather than being hidden or throwing on click.
							const join = props.joinGame ?? GAME_CATALOG[ table.game ]?.join;

							return (
								<OpenTableRow
									key={ table.id }
									table={ table }
									label={ GAME_CATALOG[ table.game ]?.label ?? table.game.toUpperCase() }
									now={ now }
									onJoin={ join ? () => joinTable.mutate( table ) : undefined }
									isJoining={ joinTable.isPending && joinTable.variables?.id === table.id }
									disabled={ joinTable.isPending }
								/>
							);
						} ) }
					</div>
				) }
		</div>
	);
}
