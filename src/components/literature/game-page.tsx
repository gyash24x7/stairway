"use client";

import { ActionPanel } from "@/components/literature/action-panel";
import { DisplayTeams } from "@/components/literature/display-teams";
import { GameCompleted } from "@/components/literature/game-completed";
import { PlayerLobby } from "@/components/literature/player-lobby";
import { DisplayHand } from "@/components/main/display-hand";
import { GameCode } from "@/components/main/game-code";
import { store } from "@/stores/literature";
import type { Literature } from "@/types/literature";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

export function GamePage( props: { data: Literature.Store } ) {
	const status = useStore( store, state => state.game.status );
	const lastMove = useStore( store, state => state.lastMoveData?.move );
	const code = useStore( store, state => state.game.code );
	const hand = useStore( store, state => state.hand );

	const areTeamsCreated = status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED";

	useEffect( () => {
		store.setState( () => props.data );
	}, [] );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ areTeamsCreated && <DisplayTeams/> }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "IN_PROGRESS" && !!lastMove && (
					<div className={ "p-3 border-2 rounded-md" }>
						<p>{ lastMove.description }</p>
					</div>
				) }
				<PlayerLobby withBg withCardCount={ status === "IN_PROGRESS" }/>
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}