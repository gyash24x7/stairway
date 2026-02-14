import { Spinner } from "@s2h-ui/primitives/spinner";
import { DisplayHand } from "@s2h-ui/shared/display-hand";
import { GameInfo } from "@s2h-ui/shared/game-info";
import { useStore } from "@tanstack/react-store";
import { ActionPanel } from "./action-panel.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { PlayerLobby } from "./player-lobby.tsx";
import { store } from "./store.tsx";
import { TeamsView } from "./teams-view.tsx";

export function GameView() {
	const gameType = useStore( store, state => state.config.type );
	const status = useStore( store, state => state.status );
	const code = useStore( store, state => state.code );
	const hand = useStore( store, state => state.hand );
	const ask = useStore( store, state => state.askHistory[ 0 ] );
	const teams = useStore( store, state => state.teams );
	const creator = useStore( store, state => state.createdBy );
	const playerId = useStore( store, state => state.playerId );
	const areTeamsCreated = status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED";

	return (
		<div className={ `flex flex-col gap-3 w-full max-w-6xl justify-self-center` }>
			<GameInfo
				code={ code }
				name={ "fish" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TYPE</p>
						<h1 className={ "text-2xl md:text-4xl font-heading" }>{ gameType }</h1>
					</div>
				}
				completed={ status === "COMPLETED" }
			/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ areTeamsCreated && <TeamsView/> }
				<PlayerLobby
					withBg
					withCardCount={ status === "IN_PROGRESS" }
					asTeams={ status !== "IN_PROGRESS" ? undefined : Object.values( teams ).reduce(
						( acc, team ) => {
							acc[ team.name ] = team.players;
							return acc;
						},
						{} as Record<string, string[]>
					) }
				/>
				{ status === "CREATED" && (
					<div className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
						<Spinner size={ "xl" }/>
						<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
							WAITING FOR PLAYERS
						</p>
					</div>
				) }
				{ status === "PLAYERS_READY" && creator !== playerId && (
					<div className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
						<Spinner size={ "xl" }/>
						<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
							WAITING FOR TEAM CREATION
						</p>
					</div>
				) }
				{ status === "TEAMS_CREATED" && creator !== playerId && (
					<div className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
						<Spinner size={ "xl" }/>
						<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
							WAITING FOR GAME TO START
						</p>
					</div>
				) }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "IN_PROGRESS" && !!ask && (
					<div className={ "p-3 bg-background rounded-md text-center" }>
						<p>{ ask.description.toUpperCase() }</p>
					</div>
				) }
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}