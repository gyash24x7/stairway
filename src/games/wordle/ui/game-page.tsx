import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { useAuth } from "@/auth/ui/use-auth";
import { wordleLiveViewAtom } from "@/games/wordle/ui/client";
import { WordleGameView } from "@/games/wordle/ui/game-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { PlayerId } from "@/swish/schema";


function WordleBoard( { gameId }: { gameId: string } ) {
	const viewAtom = wordleLiveViewAtom( gameId );
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
				action={ { label: "BACK TO WORDLE", to: "/wordle" } }
			/>
		);
	}

	if ( !game || !me ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	const playerId = PlayerId.make( me.id );

	// Not a seat, but not a closed door either. The view a stranger is served is
	// already redacted for somebody without a seat, so what this withholds is
	// not information — it is the table itself, which is worth asking for
	// rather than wandering into. The ask lives on the join page, so that is
	// where the way out points.
	const watching = game.runtime.spectators[ playerId ] !== undefined;
	const seated = game.context.players.includes( playerId );

	if ( !seated && !watching && game.status !== "CREATED" ) {
		return (
			<ErrorState
				title={ "You don't have a seat in this game" }
				message={ "This game is already under way, but you can still watch it." }
				action={ { label: "WATCH THIS GAME", to: `/wordle/${ gameId }/join` } }
			/>
		);
	}

	return <WordleGameView game={ game } gameId={ gameId } me={ playerId }/>;
}

export function WordleGamePage() {
	const { gameId } = useParams();

	return (
		<RequireSession>
			{ gameId
				? <WordleBoard gameId={ gameId }/>
				: (
					<ErrorState
						message={ "No game was named." }
						action={ { label: "BACK", to: "/wordle" } }
					/>
				) }
		</RequireSession>
	);
}
