import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { kingdominoLiveViewAtom } from "@/games/kingdomino/ui/client";
import { KingdominoGameView } from "@/games/kingdomino/ui/game-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { useGamePath } from "@/swish/ui/game-path";

function KingdominoBoard( { gameId }: { gameId: string } ) {
	const path = useGamePath();
	const viewAtom = kingdominoLiveViewAtom( gameId );
	const result = useAtomValue( viewAtom );
	const refresh = useAtomRefresh( viewAtom );

	const game = AsyncResult.isSuccess( result ) ? result.value : undefined;

	// A finished game cannot change again, so it stops being watched once it has.
	if ( result.waiting && !game ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	if ( AsyncResult.isFailure( result ) ) {
		return (
			<ErrorState
				title={ "Couldn't open this table" }
				error={ Option.getOrUndefined( AsyncResult.error( result ) ) }
				onRetry={ refresh }
				action={ { label: "BACK TO KINGDOMINO", to: path( "kingdomino" ) } }
			/>
		);
	}

	if ( !game ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	return <KingdominoGameView game={ game } gameId={ gameId }/>;
}

export function KingdominoGamePage() {
	const path = useGamePath();
	const { gameId } = useParams();

	return (
		<RequireSession>
			{ gameId
				? <KingdominoBoard gameId={ gameId }/>
				: <ErrorState message={ "No game was named." }
											action={ { label: "BACK", to: path( "kingdomino" ) } }/> }
		</RequireSession>
	);
}
