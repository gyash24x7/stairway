import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { useGameSync } from "@/client.ts";
import { splendorApi } from "@/games/splendor/client/client.ts";
import { SplendorProvider } from "@/games/splendor/client/context.tsx";
import { ControllerView } from "@/games/splendor/client/controller-view.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { GameId } from "@/swish/shared/schema.ts";

/**
 * The controller page. Same data path as the full game page — the player sync
 * socket over the seat's own view — only the rendered layout differs.
 */
export function SplendorControllerPage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo } = useAuth();

	const queryKey = [ "splendor", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => splendorApi.getView( gameId, signal )
	} );

	useGameSync( { gameName: "splendor", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "JOIN A GAME", to: "/splendor" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	// A controller is a seat's own screen. Without one there is nothing to drive,
	// so send them to the lobby rather than rendering a board they cannot play.
	if ( !data.view.playerId ) {
		return (
			<ErrorState
				title={ "You're not at this table" }
				message={ "Join the game with its code first." }
				action={ { label: "JOIN A GAME", to: "/splendor" } }
			/>
		);
	}

	return (
		<SplendorProvider data={ data } gameId={ gameId }>
			<ControllerView/>
		</SplendorProvider>
	);
}
