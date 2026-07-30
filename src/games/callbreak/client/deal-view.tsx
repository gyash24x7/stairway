"use client";

import { RCard } from "@/shared/ui/components/card";
import { RPlayerInfo } from "@/shared/ui/components/player-info";
import { cn } from "@/shared/ui/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment } from "react";
import { useCallbreak } from "./context";
import { HandView } from "./hand-view";
import { Scores } from "./scores";

export function DealView() {
	const { data } = useCallbreak();
	const currentTurn = data.context.currentPlayer;
	const activeTrick = data.view.activeDeal?.tricks[ 0 ];
	const allPlayersPlayed = Object.keys( activeTrick?.cards ?? {} ).length === 4;

	return (
		<Fragment>
			<div className={ cn( "grid grid-cols-1 lg:grid-cols-2 gap-3" ) }>
				<Scores/>
				<div className={ "grid gap-3 grid-cols-2" }>
					{ [ 0, 1, 3, 2 ].map( ( idx ) => {
						const playerId = data.context.players[ idx ];
						const cardId = activeTrick?.cards[ playerId ];
						const isRightSide = idx === 1 || idx === 2;
						const isWinner = activeTrick?.winner === playerId;
						const isCurrent = !allPlayersPlayed && currentTurn === playerId;
						return (
							<motion.div
								key={ playerId }
								className={ cn(
									"w-full p-2 md:p-4 rounded-md bg-background",
									"flex gap-3 items-center justify-between relative",
									isCurrent && "border-accent border-4",
									isWinner && "border-green-500 border-4",
									isRightSide ? "flex-row-reverse" : "flex-row"
								) }
								animate={ isWinner
									? {
										scale: [ 1, 1.04, 1 ],
										boxShadow: [
											"0 0 0 0 rgba(34,197,94,0)",
											"0 0 0 12px rgba(34,197,94,0.4)",
											"0 0 0 0 rgba(34,197,94,0)"
										]
									}
									: { scale: 1 }
								}
								transition={ isWinner
									? { duration: 1, repeat: 1 }
									: { type: "spring", stiffness: 400, damping: 28 }
								}
							>
								<RPlayerInfo player={ data.players[ playerId ] } key={ playerId }/>
								<AnimatePresence mode={ "wait" }>
									{ cardId ? (
										<motion.div
											key={ cardId }
											layoutId={ `card-${ cardId }` }
											initial={ { scale: 0.5, opacity: 0 } }
											animate={ {
												scale: 1,
												opacity: 1,
												transition: { type: "spring", stiffness: 380, damping: 22 }
											} }
											exit={ {
												opacity: 0,
												scale: 0.6,
												transition: { duration: 0.35 }
											} }
										>
											<RCard cardId={ cardId }/>
										</motion.div>
									) : !!activeTrick ? (
										<motion.div
											key={ `empty-${ playerId }` }
											initial={ { opacity: 0 } }
											animate={ { opacity: 1 } }
											exit={ { opacity: 0 } }
											className={ cn(
												"w-16 md:w-20 xl:w-24 p-1 md:p-1.5 md:text-lg h-24 md:h-30 xl:h-36",
												"rounded-lg border-2 bg-surface border-dotted border-inverted-surface",
												"flex flex-col justify-between"
											) }
										/>
									) : null }
								</AnimatePresence>
							</motion.div>
						);
					} ) }
				</div>
			</div>
			{ data.status !== "COMPLETED" && <HandView/> }
		</Fragment>
	);
}
