"use client";

import { AnimatePresence, motion } from "framer-motion";

import { RCard } from "@/shared/ui/components/card.tsx";
import { RPlayerInfo } from "@/shared/ui/components/player-info.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { useCallbreakBoard } from "@/games/callbreak/client/context.tsx";
import { DeclarationBadge } from "@/games/callbreak/client/declaration-badge.tsx";

export type DealViewProps = {
	/**
	 * Stretch to fill the parent instead of sizing to content — the couch screen's
	 * giant 2×2 table. Fixed row heights are also what stops the seats jumping
	 * about as cards appear and the trick clears.
	 */
	fill?: boolean;
};

/**
 * The shared table: four seats and the trick in play. Reads only the public view,
 * so it renders unchanged on the phone and on the television. The hand is *not*
 * rendered here — the page that wants one mounts `HandView` after this.
 */
export function DealView( { fill }: DealViewProps ) {
	const { data } = useCallbreakBoard();
	const currentTurn = data.context.currentPlayer;
	const activeDeal = data.view.activeDeal;
	const activeTrick = activeDeal?.tricks[ 0 ];
	const allPlayersPlayed = Object.keys( activeTrick?.cards ?? {} ).length === 4;
	const isDeclaring = data.context.phase === "DECLARING";
	const isCompleted = data.status === "COMPLETED";

	return (
		<div
			className={ cn(
				"grid gap-3 grid-cols-2",
				fill && "w-full h-full grid-rows-2 gap-6"
			) }
		>
			{ [ 0, 1, 3, 2 ].map( ( idx ) => {
				const playerId = data.context.players[ idx ];
				const cardId = activeTrick?.cards[ playerId ];
				const isRightSide = idx === 1 || idx === 2;
				// Trick state is meaningless once the game is over — the seats are then
				// just the faces around the table, and a green "winner" ring on whoever
				// took the last trick would read as having won the game.
				const isWinner = !isCompleted && activeTrick?.winner === playerId;
				const isCurrent = !isCompleted && !allPlayersPlayed && currentTurn === playerId;
				return (
					<motion.div
						key={ playerId }
						className={ cn(
							"w-full p-2 md:p-4 rounded-md bg-background",
							"flex gap-3 items-center justify-between relative",
							isCurrent && "border-accent border-4",
							isWinner && "border-green-500 border-4",
							isRightSide ? "flex-row-reverse" : "flex-row",
							fill && "h-full min-h-0 p-6 md:p-8 rounded-xl",
							isWinner && "z-10"
						) }
						animate={ isWinner ? { scale: [ 1, 1.04, 1 ] } : { scale: 1 } }
						transition={ isWinner
							? { duration: 1, repeat: 1 }
							: { type: "spring", stiffness: 400, damping: 28 }
						}
					>
						<RPlayerInfo
							player={ data.players[ playerId ] }
							key={ playerId }
							large={ fill }
						/>
						{ !isCompleted && (
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
										<RCard cardId={ cardId } large={ fill }/>
									</motion.div>
								) : isDeclaring ? (
									<DeclarationBadge
										key={ activeDeal?.declarations[ playerId ] === undefined
											? `awaiting-${ playerId }`
											: `declared-${ playerId }` }
										wins={ activeDeal?.declarations[ playerId ] }
										large={ fill }
									/>
								) : !!activeTrick ? (
									<motion.div
										key={ `empty-${ playerId }` }
										initial={ { opacity: 0 } }
										animate={ { opacity: 1 } }
										exit={ { opacity: 0 } }
										className={ cn(
											"w-16 md:w-20 xl:w-24 p-1 md:p-1.5 md:text-lg h-24 md:h-30 xl:h-36",
											"rounded-lg border-2 bg-surface border-dotted border-inverted-surface",
											"flex flex-col justify-between",
											fill && "w-28 md:w-36 xl:w-44 h-42 md:h-54 xl:h-66"
										) }
									/>
								) : null }
							</AnimatePresence>
						) }
					</motion.div>
				);
			} ) }
		</div>
	);
}
