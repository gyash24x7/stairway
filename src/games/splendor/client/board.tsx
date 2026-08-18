"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { ReactNode } from "react";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { EmptyCard, GameCard, GameCardBack } from "@/games/splendor/client/game-card.tsx";
import { EmptyNoble, Noble, NobleBack } from "@/games/splendor/client/noble.tsx";
import { SPRING } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { Card } from "@/games/splendor/shared/schema.ts";

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
	const { data } = useSplendor();

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
								transition: SPRING
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
					.map( ( _, i ) => <EmptyNoble key={ `empty-noble-${ i }` } large={ fill }/> ) }
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
										transition: SPRING
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
							.map( ( _, i ) => <EmptyCard key={ `empty-${ level }-${ i }` } large={ fill }/> ) }
					</div>
				) ) }
			</div>
		</div>
	);
}
