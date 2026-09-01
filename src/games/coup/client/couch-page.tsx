import { useAuth } from "@/auth/client/use-auth.tsx";
import { coupApi } from "@/games/coup/client/client.ts";
import { CoupProvider } from "@/games/coup/client/context.tsx";
import { CouchView } from "@/games/coup/client/couch-view.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { CouchCanvas } from "@/swish/client/couch-canvas.tsx";
import { CouchSignedOut } from "@/swish/client/couch-shell.tsx";
import { useTableSnapshot } from "@/swish/client/use-table-snapshot.ts";
import { GameId } from "@/swish/shared/schema.ts";

/**
 * The shared-screen page. The root layout's chrome is off for this route, so the
 * loading and error states have to fill the viewport themselves.
 *
 * This is the audience Coup was waiting for: the table can be public without
 * giving anything away, because the snapshot it reads carries no seat's cards at
 * all — only counts, coins and whatever has been turned face up.
 */
export function CoupCouchPage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo, isLoading: isAuthLoading } = useAuth();

	const { data, isLoading, isError, error, refetch } = useTableSnapshot( {
		gameName: "coup",
		gameId,
		getTableState: coupApi.getView,
		enabled: !!authInfo
	} );

	// The read is session-gated, so a television nobody has signed in on gets the
	// instruction rather than a 401 rendered as an error.
	if ( !isAuthLoading && !authInfo ) {
		return <CouchSignedOut/>;
	}

	if ( isError ) {
		return (
			<CouchCanvas>
				<div className={ "w-full h-full bg-surface flex items-center justify-center" }>
					<ErrorState
						title={ "Couldn't show this game" }
						error={ error }
						onRetry={ () => void refetch() }
						action={ { label: "BACK TO LOBBY", to: "/coup" } }
					/>
				</div>
			</CouchCanvas>
		);
	}

	if ( isLoading || !data ) {
		return (
			<CouchCanvas>
				<div className={ "w-full h-full bg-surface flex items-center justify-center" }>
					<Spinner size={ "xl" }/>
				</div>
			</CouchCanvas>
		);
	}

	return (
		<CoupProvider data={ data } gameId={ gameId }>
			<CouchView/>
		</CoupProvider>
	);
}
