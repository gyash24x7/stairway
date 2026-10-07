import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { useAuth } from "@/auth/ui/use-auth";
import { callbreakLiveViewAtom } from "@/games/callbreak/ui/client";
import { ControllerView } from "@/games/callbreak/ui/controller-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { PlayerId } from "@/swish/schema";

/**
 * The controller page. Same data path as the full game page — the live view
 * subscription over the seat's own view — only the rendered layout differs.
 */
function CallbreakControllerBoard( { gameId }: { gameId: string } ) {
	const viewAtom = callbreakLiveViewAtom( gameId );
	const result = useAtomValue( viewAtom );
	const refresh = useAtomRefresh( viewAtom );

	const me = useAuth();

	const game = AsyncResult.isSuccess( result ) ? result.value : undefined;

	if ( result.waiting && !game ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	if ( AsyncResult.isFailure( result ) ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ Option.getOrUndefined( AsyncResult.error( result ) ) }
				onRetry={ refresh }
				action={ { label: "JOIN A GAME", to: "/callbreak" } }
			/>
		);
	}

	if ( !game || !me ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	// A controller is a seat's own screen. Without one there is nothing to drive,
	// so send them to the lobby rather than rendering a board they cannot play.
	if ( !game.view.playerId ) {
		return (
			<ErrorState
				title={ "You're not at this table" }
				message={ "Join the game with its code first." }
				action={ { label: "JOIN A GAME", to: "/callbreak" } }
			/>
		);
	}

	const playerId = PlayerId.make( me.id );

	return <ControllerView game={ game } gameId={ gameId } me={ playerId }/>;
}

export function CallbreakControllerPage() {
	const { gameId } = useParams();

	return (
		<RequireSession>
			{ gameId
				? <CallbreakControllerBoard gameId={ gameId }/>
				: <ErrorState message={ "No game was named." }
											action={ { label: "BACK", to: "/callbreak" } }/> }
		</RequireSession>
	);
}
