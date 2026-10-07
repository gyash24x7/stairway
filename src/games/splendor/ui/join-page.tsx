import * as Option from "effect/Option";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { useAuth } from "@/auth/ui/use-auth";
import { joinGameAtom, spectateGameAtom, splendorLiveViewAtom } from "@/games/splendor/ui/client";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { GameId, PlayerId } from "@/swish/schema";
import { JoinGame } from "@/swish/ui/join-game";


function SplendorJoinInvite( { gameId }: { gameId: string } ) {
	const viewAtom = splendorLiveViewAtom( gameId );
	const result = useAtomValue( viewAtom );
	const refresh = useAtomRefresh( viewAtom );
	const join = useAtomSet( joinGameAtom, { mode: "promiseExit" } );
	const spectate = useAtomSet( spectateGameAtom, { mode: "promiseExit" } );

	const me = useAuth();
	const game = AsyncResult.isSuccess( result ) ? result.value : undefined;

	if ( AsyncResult.isFailure( result ) ) {
		return (
			<ErrorState
				title={ "Couldn't open this invite" }
				error={ Option.getOrUndefined( AsyncResult.error( result ) ) }
				onRetry={ refresh }
				action={ { label: "BACK TO SPLENDOR", to: "/splendor" } }
			/>
		);
	}

	if ( !game || !me ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner size={ "lg" }/></div>;
	}

	const playerId = PlayerId.make( me.id );

	return (
		<JoinGame
			game={ "splendor" }
			gameId={ game.id }
			seated={ game.context.players.map( id => game.players[ id ]! ) }
			playerCount={ game.config.playerCount }
			status={ game.status }
			isMember={ game.context.players.includes( playerId ) }
			onJoin={ () => join( { params: { gameId: GameId.make( gameId ) } } ) }
			onSpectate={ () => spectate( { params: { gameId: GameId.make( gameId ) } } ) }
		/>
	);
}

/**
 * The page behind `/splendor/:gameId/join`.
 *
 * A thin shell, like the game page beside it: the per-game typed client can
 * only be reached from the game's own package, and everything that is not the
 * client is in `JoinGame`.
 */
export function SplendorJoinPage() {
	const { gameId } = useParams();

	return (
		<RequireSession>
			{ gameId
				? <SplendorJoinInvite gameId={ gameId }/>
				: (
					<ErrorState
						message={ "No game was named." }
						action={ { label: "BACK", to: "/splendor" } }
					/>
				) }
		</RequireSession>
	);
}
