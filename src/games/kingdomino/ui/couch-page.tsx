import * as Option from "effect/Option";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useParams } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { kingdominoLiveViewAtom } from "@/games/kingdomino/ui/client";
import { CouchView } from "@/games/kingdomino/ui/couch-view";
import { Spinner } from "@/shared/primitives/spinner";
import { ErrorState } from "@/shared/shell/error-state";
import { CouchCanvas } from "@/swish/ui/couch-canvas";
import { CouchSignedOut } from "@/swish/ui/couch-shell";

/**
 * The shared-screen board. `CouchShell` (mounted inside `CouchView`) already
 * wraps its content in `CouchCanvas`, so only the loading and error states —
 * rendered before `CouchView` ever mounts — need their own.
 */
function KingdominoCouchBoard( { gameId }: { gameId: string } ) {
	const viewAtom = kingdominoLiveViewAtom( gameId );
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
						action={ { label: "BACK TO LOBBY", to: "/kingdomino" } }
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

export function KingdominoCouchPage() {
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
				? <KingdominoCouchBoard gameId={ gameId }/>
				: (
					<CouchCanvas>
						<div className={ "w-full h-full flex items-center justify-center" }>
							<ErrorState
								message={ "No game was named." }
								action={ { label: "BACK", to: "/kingdomino" } }
							/>
						</div>
					</CouchCanvas>
				) }
		</RequireSession>
	);
}
