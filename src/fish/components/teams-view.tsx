import { useFish } from "@/fish/components/context";
import type { PlayerId } from "@/shared/engine/types";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { cn } from "@/shared/utils/cn";

function PlayerWithCardCount( props: { playerId: PlayerId } ) {
	const { shared } = useFish();
	const player = shared.players[ props.playerId ];
	const cardCount = shared.state.cardCounts[ player.id ];
	const isActive = player.id === shared.context.currentPlayer;
	return (
		<div
			className={ cn(
				"flex gap-2 items-center rounded-md px-2 py-1",
				isActive && "bg-accent/20"
			) }
		>
			<Avatar className={ "rounded-full w-8 h-8" }>
				<AvatarImage src={ player.avatar } alt={ "" } className={ "bg-surface" }/>
			</Avatar>
			<div className={ cn( "text-sm font-semibold" ) }>
				{ player.name.toUpperCase() }
			</div>
			<span
				className={ cn(
					"text-sm font-bold px-2 py-0.5 rounded-full",
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
					className={ cn(
						"bg-background rounded-md p-2 md:p-3",
						"flex items-baseline justify-between"
					) }
				>
					<div className={ "text-2xl md:text-4xl uppercase font-heading pr-16" }>
						{ team.name }
					</div>
					<div className={ "flex gap-3 flex-wrap flex-1" }>
						{ team.members.map( pid => <PlayerWithCardCount playerId={ pid } key={ pid }/> ) }
					</div>
					<div className={ "text-2xl md:text-4xl font-heading pl-8" }>
						{ team.score }
					</div>
				</div>
			) ) }
		</div>
	);
}