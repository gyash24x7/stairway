import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { useAuth } from "@/auth/ui/use-auth";
import { callbreakLiveViewAtom } from "@/games/callbreak/ui/client";
import { CallbreakGameView } from "@/games/callbreak/ui/game-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { PlayerId } from "@/swish/schema";
import { useGamePath } from "@/swish/ui/game-path";


function CallbreakBoard( { gameId }: { gameId: string } ) {
	const path = useGamePath();
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
				title={ "Couldn't open this table" }
				error={ Option.getOrUndefined( AsyncResult.error( result ) ) }
				onRetry={ refresh }
				action={ { label: "BACK TO CALLBREAK", to: path( "callbreak" ) } }
			/>
		);
	}

	if ( !game || !me ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	const playerId = PlayerId.make( me.id );

	return <CallbreakGameView game={ game } gameId={ gameId } me={ playerId }/>;
}

export function CallbreakGamePage() {
	const path = useGamePath();
	const { gameId } = useParams();

	return (
		<RequireSession>
			{ gameId
				? <CallbreakBoard gameId={ gameId }/>
				: <ErrorState message={ "No game was named." }
											action={ { label: "BACK", to: path( "callbreak" ) } }/> }
		</RequireSession>
	);
}
