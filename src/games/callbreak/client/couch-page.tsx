import { useAuth } from "@/auth/client/use-auth.tsx";
import { callbreakApi } from "@/games/callbreak/client/client.ts";
import { CallbreakProvider } from "@/games/callbreak/client/context.tsx";
import { CouchView } from "@/games/callbreak/client/couch-view.tsx";
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
 * The socket attaches a table audience, so every live frame is the public one.
 * The initial HTTP read is whatever the signed-in account is entitled to — a
 * hand included, if they happen to hold a seat — but `CouchView` renders only
 * public fields, so nothing private reaches the television either way.
 */
export function CallbreakCouchPage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo, isLoading: isAuthLoading } = useAuth();

	const { data, isLoading, isError, error, refetch } = useTableSnapshot( {
		gameName: "callbreak",
		gameId,
		getTableState: callbreakApi.getView,
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
						action={ { label: "BACK TO LOBBY", to: "/callbreak" } }
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
		<CallbreakProvider data={ data } gameId={ gameId }>
			<CouchView/>
		</CallbreakProvider>
	);
}
