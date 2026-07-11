import type { PlayerId } from "@s2h/engine/types";
import { RPlayerInfoStrip } from "@s2h/ui/components/player-info";
import { cn } from "@s2h/ui/utils/cn";
import { useFish } from "./context";

function PlayerWithCardCount( props: { playerId: PlayerId } ) {
	const { shared } = useFish();
	const player = shared.players[ props.playerId ];
	const cardCount = shared.state.cardCounts[ player.id ];
	const isActive = player.id === shared.context.currentPlayer;

	return (
		<div
			className={ cn(
				"flex gap-1 md:gap-2 items-center rounded-md px-2 py-1",
				isActive && "bg-accent/20"
			) }
		>
			<RPlayerInfoStrip player={ player }/>
			<span
				className={ cn(
					"text-xs md:text-sm font-bold px-2 py-0.5 rounded-full",
					cardCount > 0
						? "bg-accent text-neutral-dark"
						: "bg-neutral-400 text-white"
				) }
			>
				{ cardCount }
			</span>
		</div>
	);
}

export function TeamsView() {
	const { shared } = useFish();
	return (
		<div className={ "grid grid-cols-1 gap-2 w-full" }>
			{ Object.values( shared.state.teams ).map( team => (
				<div
					key={ team.id }
					className={ "bg-background rounded-md p-2 md:p-3 flex flex-col gap-3" }
				>
					<div className={ "flex items-baseline justify-between" }>
						<div className={ "text-2xl md:text-4xl uppercase font-heading pr-16" }>
							{ team.name }
						</div>
						<div className={ "gap-3 flex-wrap flex-1 hidden md:flex" }>
							{ team.members.map( pid => <PlayerWithCardCount playerId={ pid } key={ pid }/> ) }
						</div>
						<div className={ "text-2xl md:text-4xl font-heading pl-8" }>
							{ team.score }
						</div>
					</div>
					<div className={ "md:hidden flex w-full gap-1 flex-wrap" }>
						{ team.members.map( pid => <PlayerWithCardCount playerId={ pid } key={ pid }/> ) }
					</div>
				</div>
			) ) }
		</div>
	);
}