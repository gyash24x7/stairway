import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getStateFn } from "@/games/splendor/client/client.ts";
import { SplendorProvider } from "@/games/splendor/client/context.tsx";
import { ControllerView } from "@/games/splendor/client/controller-view.tsx";
import { useGameSync } from "@/sync.ts";

/**
 * The controller page. Same data path as the full game page — the member-gated
 * `getState` plus the player sync socket — only the rendered view differs.
 */
export function SplendorControllerPage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const queryKey = [ "splendor", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, signal )
	} );

	useGameSync( { gameName: "splendor", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		// `getState` runs `assertMember`, so the common failure here is opening a
		// controller for a table you don't hold a seat at.
		const notAMember = ( error as { _tag?: string } )?._tag === "swish/NotAMember";

		return (
			<ErrorState
				title={ notAMember ? "You're not at this table" : "Couldn't load this game" }
				message={ notAMember ? "Join the game with its code first." : undefined }
				error={ notAMember ? undefined : error }
				onRetry={ notAMember ? undefined : () => void refetch() }
				action={ { label: "JOIN A GAME", to: "/splendor" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<SplendorProvider data={ data }>
			<ControllerView/>
		</SplendorProvider>
	);
}
