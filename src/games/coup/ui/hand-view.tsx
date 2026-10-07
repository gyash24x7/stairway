import { AnimatePresence, motion } from "framer-motion";

import type { CoupCard } from "@/games/coup/schema";
import { CoupCardTile } from "@/games/coup/ui/card";


export type CoupHandViewProps = {
	readonly hand: ReadonlyArray<CoupCard>;
	/** The cards an exchange has put in front of this seat, while one is open. */
	readonly drawn: ReadonlyArray<CoupCard>;
	/** Everything this seat has surrendered. Its own record — nobody else has one. */
	readonly lost: ReadonlyArray<CoupCard>;
};

/**
 * This seat's own cards.
 *
 * The one region of the screen nobody else can see, which is why it says so
 * plainly: the whole game is played by claiming characters, and a player needs to
 * know at a glance which of their claims would survive being challenged.
 *
 * Cards already surrendered are kept here, struck through, and this is the only
 * screen at the table that shows them: a lost influence goes back into the
 * reshuffled deck without ever being turned over, so what you gave up is yours to
 * know and nobody else's to count. It is worth keeping in front of you because it
 * is not gone from the game — the Duke you surrendered is back in the deck, and
 * the next player to claim one may genuinely have drawn it.
 */
export function CoupHandView( { hand, drawn, lost }: CoupHandViewProps ) {
	return (
		<div className={ "flex w-full flex-col gap-2 rounded-md bg-background p-3" }>
			<p className={ "text-xs tracking-widest text-muted-foreground" }>
				{ "YOUR INFLUENCE — NOBODY ELSE SEES THIS" }
			</p>

			<div className={ "flex flex-wrap items-stretch gap-2" }>
				<AnimatePresence initial={ false } mode={ "popLayout" }>
					{ hand.map( ( card, index ) => (
						<motion.div
							key={ `hand-${ index }-${ card }` }
							layout
							initial={ { opacity: 0, scale: 0.8 } }
							animate={ { opacity: 1, scale: 1 } }
							exit={ { opacity: 0, scale: 0.8 } }
						>
							<CoupCardTile card={ card }/>
						</motion.div>
					) ) }
				</AnimatePresence>

				{ lost.map( ( card, index ) => (
					<CoupCardTile key={ `lost-${ index }-${ card }` } card={ card } spent/>
				) ) }
			</div>

			{ drawn.length > 0 && (
				<>
					<p className={ "text-xs tracking-widest text-muted-foreground" }>
						{ "DRAWN FROM THE DECK" }
					</p>
					<div className={ "flex flex-wrap items-stretch gap-2" }>
						{ drawn.map( ( card, index ) => (
							<CoupCardTile key={ `drawn-${ index }-${ card }` } card={ card }/>
						) ) }
					</div>
				</>
			) }
		</div>
	);
}
