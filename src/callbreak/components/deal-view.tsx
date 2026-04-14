"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { HandView } from "@/callbreak/components/hand-view";
import { Scores } from "@/callbreak/components/scores";
import { PLAYER_COUNT } from "@/callbreak/core/utils";
import { RCard } from "@/shared/components/card";
import { RPlayerInfo } from "@/shared/components/player-info";
import { cn } from "@/shared/utils/cn";
import { Fragment } from "react";

export function DealView() {
	const { match } = useCallbreak();
	const currentTurn = match.state.ctx.currentPlayer;
	const activeTrick = match.state.data.activeDeal?.tricks[ 0 ];
	const allPlayersPlayed = Object.keys( activeTrick?.cards ?? {} ).length === PLAYER_COUNT;

	return (
		<Fragment>
			<div className={ cn( "grid grid-cols-1 lg:grid-cols-2 gap-3" ) }>
				<Scores/>
				<div className={ "grid gap-3 grid-cols-2" }>
					{ [ 0, 1, 3, 2 ].map( ( idx ) => {
						const playerId = match.state.ctx.players[ idx ];
						const cardId = activeTrick?.cards[ playerId ];
						const isRightSide = idx === 1 || idx === 2;
						return (
							<div
								key={ playerId }
								className={ cn(
									"w-full flex gap-3 p-3 rounded-md items-center bg-background justify-between",
									!allPlayersPlayed && currentTurn === playerId && "border-accent border-4",
									activeTrick?.winner === playerId && "border-green-500 border-4",
									isRightSide ? "flex-row-reverse" : "flex-row"
								) }
							>
								<RPlayerInfo player={ match.players[ playerId ] } key={ playerId }/>
								{ cardId && <RCard cardId={ cardId } focused/> }
								{ !cardId && !!activeTrick && (
									<div
										className={ cn(
											"w-16 md:w-20 xl:w-24 p-1 md:p-1.5 md:text-lg h-24 md:h-30 xl:h-36",
											"rounded-lg border-2 bg-surface border-dotted border-gray-400",
											"flex flex-col justify-between"
										) }
									/>
								) }
							</div>
						);
					} ) }
				</div>
			</div>
			<HandView/>
		</Fragment>
	);
}
