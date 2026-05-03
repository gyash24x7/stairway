"use client";

import { cn } from "@/shared/utils/cn";
import { CardActions } from "@/splendor/components/card-actions";
import { useSplendor } from "@/splendor/components/context";
import { GameCardBack } from "@/splendor/components/game-card";
import { Noble, NobleBack } from "@/splendor/components/noble";
import { AnimatePresence, motion } from "framer-motion";

export function Board() {
	const { shared } = useSplendor();
	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<div
				className={ cn(
					"flex gap-2 items-center justify-between bg-background p-3 rounded-md"
				) }
			>
				<div className={ "hidden md:block" }>
					<NobleBack/>
				</div>
				<AnimatePresence mode={ "popLayout" } initial={ false }>
					{ shared.state.nobles.map( noble => (
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
							<Noble noble={ noble }/>
						</motion.div>
					) ) }
				</AnimatePresence>
				{ new Array( shared.config.playerCount + 1 - shared.state.nobles.length ).fill( 0 )
					.map( ( _, i ) => (
						<div
							key={ `empty-noble-${ i }` }
							className={ cn(
								"w-16 md:w-20 h-16 md:h-20 rounded-md",
								"border-2 border-dashed border-gray-300"
							) }
						/>
					) ) }
			</div>
			<div className={ "flex flex-col gap-2 bg-background p-3 rounded-md" }>
				{ [ 3 as const, 2 as const, 1 as const ].map( level => (
					<div
						className={ "flex gap-2 items-center justify-between w-full" }
						key={ level }
					>
						<div className={ "hidden md:block" }>
							<GameCardBack level={ level }/>
						</div>
						<AnimatePresence mode={ "popLayout" } initial={ false }>
							{ shared.state.cards[ level ].map( card => (
								<motion.div
									key={ card.id }
									layout
									layoutId={ `card-${ card.id }` }
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
									<CardActions card={ card }/>
								</motion.div>
							) ) }
						</AnimatePresence>
						{ Array.from( { length: 4 - shared.state.cards[ level ].length } )
							.map( ( _, i ) => (
								<div
									key={ `empty-${ level }-${ i }` }
									className={ cn(
										"w-16 md:w-20 h-24 md:h-30 rounded-md",
										"border-2 border-dashed border-gray-300"
									) }
								/>
							) ) }
					</div>
				) ) }
			</div>
		</div>
	);
}
