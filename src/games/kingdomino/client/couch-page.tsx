import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { CouchCanvas } from "@/shared/ui/couch/couch-canvas.tsx";
import { useTableSnapshot } from "@/shared/ui/couch/use-table-snapshot.ts";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getTableStateFn } from "@/games/kingdomino/client/client.ts";
import { KingdominoTableProvider } from "@/games/kingdomino/client/context.tsx";
import { CouchView } from "@/games/kingdomino/client/couch-view.tsx";

/**
 * The shared-screen page. The root layout's chrome is off for this route, so the
 * loading and error states have to fill the viewport themselves.
 */
export function KingdominoCouchPage( { gameId }: { gameId: string } ) {
	const { data, isLoading, isError, error, refetch } = useTableSnapshot( {
		gameName: "kingdomino",
		gameId,
		getTableState: getTableStateFn
	} );

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
		<KingdominoTableProvider data={ data }>
			<CouchView/>
		</KingdominoTableProvider>
	);
}
