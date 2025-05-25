"use client";

import { DisplayHand } from "@/shared/components/display-hand";
import { GameCode } from "@/shared/components/game-code";
import { ActionPanel } from "@/literature/components/action-panel";
import { DisplayTeams } from "@/literature/components/display-teams";
import { GameCompleted } from "@/literature/components/game-completed";
import { PlayerLobby } from "@/literature/components/player-lobby";
import { store } from "@/literature/store";
import type { Literature } from "@/literature/types";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

export function GamePage( props: { data: Literature.Store } ) {
	const status = useStore( store, state => state.game.status );
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
				<PlayerLobby withBg withCardCount={ status === "IN_PROGRESS" }/>
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}