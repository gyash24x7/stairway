import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { useGameSync } from "@/client.ts";
import { kingdominoApi } from "@/games/kingdomino/client/client.ts";
import { KingdominoProvider } from "@/games/kingdomino/client/context.tsx";
import { ControllerView } from "@/games/kingdomino/client/controller-view.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { GameId } from "@/swish/shared/schema.ts";

/**
 * The controller page. Same data path as the full game page — the player sync
 * socket over the seat's own view — only the rendered layout differs.
 */
export function KingdominoControllerPage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo } = useAuth();

	const queryKey = [ "kingdomino", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => kingdominoApi.getView( gameId, signal )
	} );

	useGameSync( { gameName: "kingdomino", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "JOIN A GAME", to: "/kingdomino" } }
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
				action={ { label: "JOIN A GAME", to: "/kingdomino" } }
			/>
		);
	}

	return (
		<KingdominoProvider data={ data } gameId={ gameId }>
			<ControllerView/>
		</KingdominoProvider>
	);
}
