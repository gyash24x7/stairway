"use client";

import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipPositioner,
	TooltipProvider,
	TooltipTrigger
} from "@/shared/primitives/tooltip";
import { cn } from "@/shared/utils/cn";
import { CardActions } from "@/splendor/components/card-actions";
import { useSplendor } from "@/splendor/components/context";
import { gemColors, gemLightColors } from "@/splendor/components/utils";
import type { Gem } from "@/splendor/core/types";
import { GEMS_WITH_GOLD } from "@/splendor/core/utils";

function PlayerTokenCount( props: { gem: Gem; playerId: string } ) {
	const { match } = useSplendor();
	const count = match.state.data.playerData[ props.playerId ].tokens[ props.gem ];

	return (
		<div className={ cn(
			"w-6 h-6 flex justify-center items-center rounded-full",
			"border border-dotted border-gray-400",
			"text-sm text-center text-neutral-dark",
			gemColors[ props.gem ]
		) }>
			{ count }
		</div>
	);
}

function ReservedCards( props: { playerId: string } ) {
	const { match } = useSplendor();
	const player = match.state.data.playerData[ props.playerId ];

	return (
		<TooltipProvider delay={ 100 } closeDelay={ 2000 }>
			<Tooltip>
				<TooltipTrigger>
					<div className={ cn(
						"w-8 h-12 p-1",
						"flex rounded-md items-center justify-center",
						"border-3 border-gray-400",
						"text-2xl text-neutral-dark",
						gemLightColors[ "gold" ]
					) }>
						<h2>{ player?.reserved?.length ?? 0 }</h2>
					</div>
				</TooltipTrigger>
				<TooltipPortal>
					<TooltipPositioner sideOffset={ 10 }>
						{ player?.reserved && player.reserved.length > 0 && (
							<TooltipContent>
								<div className={ "flex gap-3" }>
									{ player.reserved.map( card => (
										<CardActions card={ card } key={ card.id }/>
									) ) }
								</div>
							</TooltipContent>
						) }
					</TooltipPositioner>
				</TooltipPortal>
			</Tooltip>
		</TooltipProvider>
	);
}

function PurchasedCards( props: { gem: Exclude<Gem, "gold">; playerId: string; } ) {
	const { match } = useSplendor();
	const cards = match.state.data.playerData[ props.playerId ].cards;
	return (
		<div className={ cn(
			"w-8 h-12 p-1",
			"flex rounded-md items-center justify-center",
			"border-3 border-gray-400",
			"text-2xl text-neutral-dark",
			gemLightColors[ props.gem ]
		) }>
			<h2>{ cards.filter( c => c.bonus === props.gem ).length }</h2>
		</div>
	);
}

function PlayerGemInfo( props: { playerId: string } ) {
	return (
		<div className={ cn( "flex justify-around gap-2 flex-1 p-2" ) }>
			{ GEMS_WITH_GOLD.map( gem => (
				<div key={ gem } className={ "flex flex-col gap-1 items-center justify-center" }>
					{ gem !== "gold" && <PurchasedCards playerId={ props.playerId } gem={ gem }/> }
					{ gem === "gold" && <ReservedCards playerId={ props.playerId }/> }
					<PlayerTokenCount gem={ gem } playerId={ props.playerId }/>
				</div>
			) ) }
		</div>
	);
}

export function PlayerInfo( { playerId }: { playerId: string } ) {
	const { match } = useSplendor();
	const baseInfo = match.players[ playerId ];
	const gameInfo = match.state.data.playerData[ playerId ];
	const isCurrentTurn = match.status === "IN_PROGRESS" && match.state.ctx.currentPlayer === playerId;
	return (
		<div className={ cn( "bg-background rounded-md overflow-hidden", isCurrentTurn && "ring-2 ring-accent" ) }>
			<div className={ "flex gap-2 justify-between" }>
				<div className={ "flex sm:flex-col gap-2 items-center justify-center p-2 w-1/3 min-w-30 max-w-40" }>
					<Avatar className={ "rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12" }>
						<AvatarImage src={ baseInfo.avatar } alt={ "" } className={ "bg-accent" }/>
					</Avatar>
					<div className={ "flex flex-col text-center text-sm md:text-lg" }>
						{ baseInfo.name?.split( " " )[ 0 ] }
					</div>
				</div>
				<div className={ "hidden sm:flex flex-1" }>
					<PlayerGemInfo playerId={ playerId }/>
				</div>
				<div className={ "flex items-center justify-center bg-accent rounded-r-md w-16 md:w-20 shrink-0" }>
					<div className={ "text-4xl font-heading text-neutral-dark text-center" }>
						{ gameInfo.points }
					</div>
				</div>
			</div>
			<div className={ "block sm:hidden" }>
				<PlayerGemInfo playerId={ playerId }/>
			</div>
		</div>
	);
}
