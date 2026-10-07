import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { useAuth } from "@/auth/ui/use-auth";
import { coupLiveViewAtom } from "@/games/coup/ui/client";
import { CoupGameView } from "@/games/coup/ui/game-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { PlayerId } from "@/swish/schema";


function CoupBoard( { gameId }: { gameId: string } ) {
	const viewAtom = coupLiveViewAtom( gameId );
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
				title={ "Couldn't open this table" }
				error={ Option.getOrUndefined( AsyncResult.error( result ) ) }
				onRetry={ refresh }
				action={ { label: "BACK TO COUP", to: "/coup" } }
			/>
		);
	}

	if ( !game || !me ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	const playerId = PlayerId.make( me.id );
	const watching = game.runtime.spectators[ playerId ] !== undefined;
	const seated = game.context.players.includes( playerId );

	if ( !seated && !watching && game.status !== "CREATED" ) {
		return (
			<ErrorState
				title={ "You don't have a seat in this game" }
				message={ "This game is already under way, but you can still watch it." }
				action={ { label: "WATCH THIS GAME", to: `/coup/${ gameId }/join` } }
			/>
		);
	}

	return <CoupGameView game={ game } gameId={ gameId } me={ playerId }/>;
}

export function CoupGamePage() {
	const { gameId } = useParams();

	return (
		<RequireSession>
			{ gameId
				? <CoupBoard gameId={ gameId }/>
				: (
					<ErrorState
						message={ "No game was named." }
						action={ { label: "BACK", to: "/coup" } }
					/>
				) }
		</RequireSession>
	);
}
