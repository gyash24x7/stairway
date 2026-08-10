"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/shared/ui/utils/cn.ts";
import type { Card } from "@/games/splendor/shared/schema.ts";
import { useSplendorBoard } from "@/games/splendor/client/context.tsx";
import { GameCard, GameCardBack } from "@/games/splendor/client/game-card.tsx";
import { Noble, NobleBack } from "@/games/splendor/client/noble.tsx";

export type BoardProps = {
	renderCard?: ( card: Card ) => ReactNode;
	/**
	 * Fill the parent instead of sizing to content — the couch screen's board.
	 * The three card rows split the available height and each card takes its width
	 * from that, so the board scales itself to whatever the television offers.
	 */
	fill?: boolean;
};

export function Board( { renderCard, fill }: BoardProps ) {
	const { data } = useSplendorBoard();

	return (
		<div className={ cn( "flex flex-col gap-3 w-full", fill && "h-full min-h-0 gap-4" ) }>
			<div
				className={ cn(
					"flex gap-2 items-center justify-between bg-background p-3 rounded-md",
					fill && "shrink-0 gap-4 p-4 rounded-xl justify-around"
				) }
			>
				<div className={ "hidden md:block" }>
					<NobleBack large={ fill }/>
				</div>
				<AnimatePresence mode={ "popLayout" } initial={ false }>
					{ data.view.nobles.map( noble => (
						<motion.div
							key={ noble.id }
							layout
							layoutId={ `noble-${ noble.id }` }
							initial={ { scale: 0.5, opacity: 0 } }
							animate={ {
								scale: 1,
								opacity: 1,
								transition: { type: "spring", stiffness: 380, damping: 22 }
							} }
							exit={ {
								opacity: 0,
								scale: 0.4,
								transition: { duration: 0.4 }
							} }
						>
							<Noble noble={ noble } large={ fill }/>
						</motion.div>
					) ) }
				</AnimatePresence>
				{ new Array( data.config.playerCount + 1 - data.view.nobles.length ).fill( 0 )
					.map( ( _, i ) => (
						<div
							key={ `empty-noble-${ i }` }
							className={ cn(
								"w-16 md:w-20 h-16 md:h-20 rounded-md",
								"border-2 border-dashed border-gray-300",
								fill && "w-28 h-28 md:w-32 md:h-32 rounded-xl"
							) }
						/>
					) ) }
			</div>
			<div
				className={ cn(
					"flex flex-col gap-2 bg-background p-3 rounded-md",
					fill && "flex-1 min-h-0 gap-3 p-4 rounded-xl"
				) }
			>
				{ [ 3 as const, 2 as const, 1 as const ].map( level => (
					<div
						className={ cn(
							"flex gap-2 items-center justify-between w-full",
							fill && "flex-1 min-h-0 gap-4 justify-around"
						) }
						key={ level }
					>
						<div className={ cn( "hidden md:block", fill && "md:h-full" ) }>
							<GameCardBack level={ level } large={ fill }/>
						</div>
						<AnimatePresence mode={ "popLayout" } initial={ false }>
							{ data.view.cards[ level ].map( card => (
								<motion.div
									key={ card.id }
									layout
									layoutId={ `card-${ card.id }` }
									className={ cn( fill && "h-full" ) }
									initial={ { scale: 0.5, opacity: 0 } }
									animate={ {
										scale: 1,
										opacity: 1,
										transition: { type: "spring", stiffness: 380, damping: 22 }
									} }
									exit={ {
										opacity: 0,
										scale: 0.5,
										transition: { duration: 0.3 }
									} }
								>
									{ renderCard?.( card ) ?? <GameCard card={ card } large={ fill }/> }
								</motion.div>
							) ) }
						</AnimatePresence>
						{ Array.from( { length: 4 - data.view.cards[ level ].length } )
							.map( ( _, i ) => (
								<div
									key={ `empty-${ level }-${ i }` }
									className={ cn(
										"w-16 md:w-20 h-24 md:h-30 rounded-md",
										"border-2 border-dashed border-gray-300",
										fill && "h-full w-auto aspect-[2/3] rounded-xl"
									) }
								/>
							) ) }
					</div>
				) ) }
			</div>
		</div>
	);
}
