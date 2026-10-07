import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { splendorLiveViewAtom } from "@/games/splendor/ui/client";
import { CouchView } from "@/games/splendor/ui/couch-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { CouchCanvas } from "@/swish/ui/couch-canvas";
import { CouchSignedOut } from "@/swish/ui/couch-shell";


/**
 * The shared-screen page. A television holds no seat, so this reads the same
 * envelope over the same subscription as the full page but never treats an
 * absent `view.playerId` as an error.
 */
export function SplendorCouchPage() {
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
				? <SplendorCouchBoard gameId={ gameId }/>
				: (
					<CouchCanvas>
						<div className={ "w-full h-full flex items-center justify-center" }>
							<ErrorState
								message={ "No game was named." }
								action={ { label: "BACK", to: "/splendor" } }
							/>
						</div>
					</CouchCanvas>
				) }
		</RequireSession>
	);
}

function SplendorCouchBoard( { gameId }: { gameId: string } ) {
	const viewAtom = splendorLiveViewAtom( gameId );
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
						action={ { label: "BACK TO LOBBY", to: "/splendor" } }
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
