"use client";

import { ActionPanel } from "@/fish/components/action-panel";
import { DisplayTeams } from "@/fish/components/display-teams";
import { GameCompleted } from "@/fish/components/game-completed";
import { PlayerLobby } from "@/fish/components/player-lobby";
import { store } from "@/fish/store";
import type { FishPlayerGameInfo } from "@/libs/fish/types";
import { DisplayHand } from "@/shared/components/display-hand";
import { GameCode } from "@/shared/components/game-code";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

export function GamePage( props: { data: FishPlayerGameInfo } ) {
	const status = useStore( store, state => state.status );
	const code = useStore( store, state => state.code );
	const hand = useStore( store, state => state.hand );
	const ask = useStore( store, state => state.askHistory[ 0 ] );

	const areTeamsCreated = status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED";

	useEffect( () => {
		store.setState( () => props.data );
	}, [ props.data ] );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ areTeamsCreated && <DisplayTeams/> }
				<PlayerLobby withBg withCardCount={ status === "IN_PROGRESS" }/>
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "IN_PROGRESS" && !!ask && (
					<div className={ "p-3 border-2 rounded-md" } key={ ask.timestamp }>
						<p>{ ask.description }</p>
					</div>
				) }
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}