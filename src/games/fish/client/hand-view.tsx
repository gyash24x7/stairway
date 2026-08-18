"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import { useFish } from "@/games/fish/client/context.tsx";
import {
	getBookDisplayString,
	getBooksInHand,
	getCardsOfBook
} from "@/games/fish/shared/utils.ts";
import { RCard } from "@/shared/ui/components/card.tsx";
import { SPRING } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

export function HandView() {
	const { data } = useFish();
	const hand = data.view.hand;

	const groupedCards = useMemo(
		() => getBooksInHand( hand, data.config.type ).map(
			book => ( { book, cards: getCardsOfBook( book, hand ) } )
		),
		[ hand, data.config.type ]
	);

	if ( hand.length === 0 ) {
		return (
			<div className={ "bg-background rounded-md p-3 w-full text-center" }>
				<p className={ "text-sm md:text-lg font-semibold opacity-60" }>
					NO CARDS LEFT — WATCH FOR CLAIMS FROM YOUR TEAM
				</p>
			</div>
		);
	}

	return (
		<motion.div
			layout
			className={ cn(
				"bg-background rounded-md p-2 md:p-3 flex",
				"gap-4 md:gap-6 flex-wrap justify-center w-full"
			) }
		>
			<AnimatePresence mode={ "popLayout" }>
				{ groupedCards.map( ( { book, cards } ) => (
					<motion.div
						key={ book }
						layout
						initial={ { opacity: 0, scale: 0.9 } }
						animate={ { opacity: 1, scale: 1 } }
						exit={ { opacity: 0, scale: 0.9 } }
						className={ "flex flex-col items-center gap-1" }
					>
						<span className={ "text-xs md:text-sm font-semibold opacity-60" }>
							{ getBookDisplayString( book, data.config.type ) }
						</span>
						<motion.div
							layout
							className={ "flex gap-1.5 md:gap-2 flex-wrap justify-center" }
						>
							<AnimatePresence mode={ "popLayout" }>
								{ cards.map( cardId => (
									<motion.div
										key={ cardId }
										layout
										layoutId={ `fish-card-${ cardId }` }
										initial={ { opacity: 0, scale: 0.6 } }
										animate={ {
											opacity: 1,
											scale: 1,
											transition: SPRING
										} }
										exit={ {
											opacity: 0,
											scale: 0.6,
											transition: { duration: 0.25 }
										} }
									>
										<RCard cardId={ cardId }/>
									</motion.div>
								) ) }
							</AnimatePresence>
						</motion.div>
					</motion.div>
				) ) }
			</AnimatePresence>
		</motion.div>
	);
}
