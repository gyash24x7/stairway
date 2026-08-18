import { useAuth } from "@/auth/client/use-auth.tsx";
import { kingdominoApi } from "@/games/kingdomino/client/client.ts";
import { KingdominoProvider } from "@/games/kingdomino/client/context.tsx";
import { CouchView } from "@/games/kingdomino/client/couch-view.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { CouchCanvas } from "@/swish/client/couch-canvas.tsx";
import { CouchSignedOut } from "@/swish/client/couch-shell.tsx";
import { useTableSnapshot } from "@/swish/client/use-table-snapshot.ts";
import { GameId } from "@/swish/shared/schema.ts";

/**
 * The shared-screen page. The root layout's chrome is off for this route, so the
 * loading and error states have to fill the viewport themselves.
 */
export function KingdominoCouchPage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo, isLoading: isAuthLoading } = useAuth();

	const { data, isLoading, isError, error, refetch } = useTableSnapshot( {
		gameName: "kingdomino",
		gameId,
		getTableState: kingdominoApi.getView,
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
						action={ { label: "BACK TO LOBBY", to: "/kingdomino" } }
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
		<KingdominoProvider data={ data } gameId={ gameId }>
			<CouchView/>
		</KingdominoProvider>
	);
}
