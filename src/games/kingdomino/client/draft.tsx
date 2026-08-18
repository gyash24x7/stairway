import { AnimatePresence, motion } from "framer-motion";

import { RDomino } from "@/games/kingdomino/client/domino.tsx";
import { SPRING } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { DraftEntry } from "@/games/kingdomino/shared/schema.ts";
import type { Roster } from "@/swish/shared/schema.ts";

export type RDraftProps = {
	draft: readonly DraftEntry[];
	active?: boolean;
	players: Roster;
	/**
	 * Television sizing — one entry per row at couch scale. The couch draft lives
	 * in the narrow right rail, so it stacks rather than spreading across columns.
	 */
	large?: boolean;
	/**
	 * Two columns at every width, rather than widening to four on a large screen.
	 * The controller lives in a phone-width column whatever the viewport is, so a
	 * viewport-driven breakpoint would spread four dominoes across it edge to edge.
	 */
	compact?: boolean;
	/**
	 * One entry per row, as a column. The full page stands the draft beside the
	 * player's kingdom rather than under it, so it has a tall narrow space to fill
	 * rather than a wide short one.
	 */
	vertical?: boolean;
	onSelect?: ( dominoId: number ) => void;
	className?: string;
};

export function RDraft( props: RDraftProps ) {
	const sorted = props.draft.toSorted( ( a, b ) => a.domino.id - b.domino.id );
	return (
		<motion.div
			className={ cn(
				"p-3 rounded-md bg-background flex-1 justify-items-center",
				"grid grid-cols-2 lg:grid-cols-4 col-span-2",
				"items-center gap-2 justify-center",
				props.compact && "lg:grid-cols-2 col-span-1",
				props.vertical && "grid-cols-1 lg:grid-cols-1 col-span-1",
				props.large && "grid-cols-1 lg:grid-cols-1 col-span-1 gap-4 p-5 rounded-xl",
				props.className
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
							className={ cn( "flex items-center gap-2", props.large && "gap-5" ) }
							variants={ {
								initial: { opacity: 0, scale: 0.6 },
								animate: {
									opacity: 1,
									scale: 1,
									transition: SPRING
								}
							} }
							exit={ { opacity: 0, scale: 0.6, transition: { duration: 0.2 } } }
						>
							<div
								className={ cn(
									"flex justify-center items-center shrink-0",
									"w-6 md:w-8 h-6 md:h-8 rounded-full bg-accent",
									props.large && "w-18 md:w-18 h-18 md:h-18"
								) }
							>
								<span
									className={ cn(
										"text-xs md:text-base",
										props.large && "text-5xl font-heading text-neutral-dark"
									) }
								>
									{ e.domino.id }
								</span>
							</div>
							<RDomino
								domino={ e.domino }
								enabled={ isAvailable }
								large={ props.large }
								onClick={ isAvailable ? props.onSelect : undefined }
							/>
							<AnimatePresence mode={ "wait" }>
								{ avatar ? (
									<motion.img
										key={ `avatar-${ pickedBy }` }
										src={ avatar }
										alt={ pickedBy ? props.players[ pickedBy ]?.name ?? "" : "" }
										className={ cn(
											"w-6 md:w-8 h-6 md:h-8 shrink-0",
											"rounded-full border border-border object-cover bg-accent",
											props.large && "w-14 md:w-14 h-14 md:h-14 border-2"
										) }
										initial={ { scale: 0, opacity: 0 } }
										animate={ {
											scale: 1,
											opacity: 1,
											transition: SPRING
										} }
										exit={ { scale: 0, opacity: 0, transition: { duration: 0.15 } } }
									/>
								) : (
									<motion.div
										key={ "empty-avatar" }
										className={ cn(
											"w-8 h-8 rounded-full bg-surface shrink-0",
											props.large && "w-14 h-14"
										) }
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
