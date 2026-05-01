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
	const { shared } = useCallbreak();
	const currentTurn = shared.context.currentPlayer;
	const activeTrick = shared.state.activeDeal?.tricks[ 0 ];
	const allPlayersPlayed = Object.keys( activeTrick?.cards ?? {} ).length === PLAYER_COUNT;

	return (
		<Fragment>
			<div className={ cn( "grid grid-cols-1 lg:grid-cols-2 gap-3" ) }>
				<Scores/>
				<div className={ "grid gap-3 grid-cols-2" }>
					{ [ 0, 1, 3, 2 ].map( ( idx ) => {
						const playerId = shared.context.players[ idx ];
						const cardId = activeTrick?.cards[ playerId ];
						const isRightSide = idx === 1 || idx === 2;
						return (
							<div
								key={ playerId }
								className={ cn(
									"w-full p-2 md:p-4 rounded-md bg-background",
									"flex gap-3 items-center justify-between",
									!allPlayersPlayed && currentTurn === playerId && "border-accent border-4",
									activeTrick?.winner === playerId && "border-green-500 border-4",
									isRightSide ? "flex-row-reverse" : "flex-row"
								) }
							>
								<RPlayerInfo player={ shared.players[ playerId ] } key={ playerId }/>
								{ cardId && <RCard cardId={ cardId }/> }
								{ !cardId && !!activeTrick && (
									<div
										className={ cn(
											"w-16 md:w-20 xl:w-24 p-1 md:p-1.5 md:text-lg h-24 md:h-30 xl:h-36",
											"rounded-lg border-2 bg-surface border-dotted border-inverted-surface",
											"flex flex-col justify-between"
										) }
									/>
								) }
							</div>
						);
					} ) }
				</div>
			</div>
			{ shared.status !== "COMPLETED" && <HandView/> }
		</Fragment>
	);
}
