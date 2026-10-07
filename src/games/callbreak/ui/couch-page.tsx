import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { callbreakLiveViewAtom } from "@/games/callbreak/ui/client";
import { CouchView } from "@/games/callbreak/ui/couch-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { CouchCanvas } from "@/swish/ui/couch-canvas";
import { CouchSignedOut } from "@/swish/ui/couch-shell";

/**
 * The shared-screen page. The subscription is the only read, and it carries
 * whatever the signed-in account is entitled to — a hand included, if they
 * happen to hold a seat — but `CouchView` renders only public fields, so nothing
 * private reaches the television.
 */
function CallbreakCouchBoard( { gameId }: { gameId: string } ) {
	const viewAtom = callbreakLiveViewAtom( gameId );
	const result = useAtomValue( viewAtom );
	const refresh = useAtomRefresh( viewAtom );

	const game = AsyncResult.isSuccess( result ) ? result.value : undefined;

	if ( AsyncResult.isFailure( result ) ) {
		return (
			<CouchCanvas>
				<div className={ "w-full h-full bg-surface flex items-center justify-center" }>
					<ErrorState
						title={ "Couldn't show this game" }
						error={ Option.getOrUndefined( AsyncResult.error( result ) ) }
						onRetry={ refresh }
						action={ { label: "BACK TO LOBBY", to: "/callbreak" } }
					/>
				</div>
			</CouchCanvas>
		);
	}

	if ( !game ) {
		return (
			<CouchCanvas>
				<div className={ "w-full h-full bg-surface flex items-center justify-center" }>
					<Spinner size={ "xl" }/>
				</div>
			</CouchCanvas>
		);
	}

	return <CouchView game={ game }/>;
}

export function CallbreakCouchPage() {
	const { gameId } = useParams();

	// The view is session-gated, so a television nobody has signed in on gets the
	// instruction rather than a 401 rendered as an error — and a spinner, not that
	// instruction, while the session is still being read.
	return (
		<RequireSession
			fallback={ <CouchSignedOut/> }
			loading={
				<CouchCanvas>
					<div className={ "w-full h-full flex items-center justify-center" }>
						<Spinner size={ "xl" }/>
					</div>
				</CouchCanvas>
			}
		>
			{ gameId
				? <CallbreakCouchBoard gameId={ gameId }/>
				: (
					<CouchCanvas>
						<div className={ "w-full h-full flex items-center justify-center" }>
							<ErrorState
								message={ "No game was named." }
								action={ { label: "BACK", to: "/callbreak" } }
							/>
						</div>
					</CouchCanvas>
				) }
		</RequireSession>
	);
}
