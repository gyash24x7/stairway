import { AnimatePresence, motion } from "framer-motion";

import type { DraftEntry } from "@/games/kingdomino/shared/schema.ts";
import type { Players } from "@/shared/swish/schema.ts";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RDomino } from "@/games/kingdomino/client/domino.tsx";

export type RDraftProps = {
	draft: readonly DraftEntry[];
	active?: boolean;
	players: Players;
	onSelect?: ( dominoId: number ) => void;
}

export function RDraft( props: RDraftProps ) {
	const sorted = props.draft.toSorted( ( a, b ) => a.domino.id - b.domino.id );
	return (
		<motion.div
			className={ cn(
				"p-3 rounded-md bg-background flex-1 justify-items-center",
				"grid grid-cols-2 lg:grid-cols-4 col-span-2",
				"items-center gap-2 justify-center"
			) }
			initial={ "initial" }
			animate={ "animate" }
			variants={ { animate: { transition: { staggerChildren: 0.06 } } } }
		>
			<AnimatePresence mode={ "popLayout" }>
				{ sorted.map( e => {
					const pickedBy = e.selectedBy;
					const avatar = pickedBy ? props.players[ pickedBy ]?.avatar : null;
					const isAvailable = !pickedBy && props.active;

					if ( !e.domino ) {
						return null;
					}

					return (
						<motion.div
							key={ e.domino.id }
							layout
							className={ "flex items-center gap-2" }
							variants={ {
								initial: { opacity: 0, scale: 0.6 },
								animate: {
									opacity: 1,
									scale: 1,
									transition: { type: "spring", stiffness: 380, damping: 22 }
								}
							} }
							exit={ { opacity: 0, scale: 0.6, transition: { duration: 0.2 } } }
						>
							<div
								className={ cn(
									"flex justify-center items-center",
									"w-6 md:w-8 h-6 md:h-8 rounded-full bg-accent"
								) }
							>
								<span className={ "text-xs md:text-md" }>{ e.domino.id }</span>
							</div>
							<RDomino
								domino={ e.domino }
								enabled={ isAvailable }
								onClick={ isAvailable ? props.onSelect : undefined }
							/>
							<AnimatePresence mode={ "wait" }>
								{ avatar ? (
									<motion.img
										key={ `avatar-${ pickedBy }` }
										src={ avatar }
										alt={ pickedBy ? props.players[ pickedBy ].name : "picked player" }
										className={ "w-6 md:w-8 h-6 md:h-8 rounded-full border border-border object-cover bg-accent" }
										initial={ { scale: 0, opacity: 0 } }
										animate={ {
											scale: 1,
											opacity: 1,
											transition: { type: "spring", stiffness: 380, damping: 22 }
										} }
										exit={ { scale: 0, opacity: 0, transition: { duration: 0.15 } } }
									/>
								) : (
									<motion.div
										key={ "empty-avatar" }
										className={ "w-8 h-8 rounded-full bg-surface" }
										initial={ { opacity: 0 } }
										animate={ { opacity: 1 } }
										exit={ { opacity: 0 } }
									/>
								) }
							</AnimatePresence>
						</motion.div>
					);
				} ) }
			</AnimatePresence>
		</motion.div>
	);
}
