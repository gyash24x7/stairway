import { cn } from "cn";
import { motion } from "framer-motion";

import type { Book, FishConfig, FishView } from "@/games/fish/schema";
import { claimsOf, getBookDisplayString, getBookWinner } from "@/games/fish/utils";
import type { GameView, TeamId } from "@/swish/schema";
import { nameOf } from "@/swish/utils";


/** One colour per side, in the order the config declares them. */
const TEAM_COLORS = [ "bg-accent", "bg-blue-500", "bg-purple-500", "bg-orange-500" ];

export type BooksTrackerProps = {
	readonly game: GameView<FishView, FishConfig>;
};

export function BooksTracker( { game }: BooksTrackerProps ) {
	// Where each declared book went. Derived from the declarations rather than
	// stored, so it cannot disagree with the scores the engine ranks the sides by.
	const owners = new Map<Book, TeamId>();
	for ( const claim of claimsOf( game.view ) ) {
		const winner = getBookWinner( claim, game.context );
		if ( winner !== undefined ) {
			owners.set( claim.book, winner );
		}
	}

	const colorOf = ( team: TeamId ) =>
		TEAM_COLORS[ game.config.teams.indexOf( team ) ] ?? "bg-accent";

	const labelOf = ( team: TeamId ) =>
		nameOf( game.context, team ) ?? `TEAM ${ game.config.teams.indexOf( team ) + 1 }`;

	return (
		<div className={ "bg-background rounded-md p-3 md:p-4 w-full" }>
			<h2 className={ "text-sm md:text-base font-semibold mb-3" }>BOOKS WON</h2>
			<div className={ "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2" }>
				{ game.config.books.map( book => {
					const owner = owners.get( book );
					return (
						<motion.div
							key={ book }
							layout
							animate={ owner
								? { scale: [ 1, 1.08, 1 ], transition: { duration: 0.6 } }
								: { scale: 1 }
							}
							className={ cn(
								"rounded-md px-2 py-2 text-center",
								owner ? colorOf( owner ) : "bg-surface"
							) }
						>
							<p
								className={ cn(
									"text-sm md:text-base font-bold",
									owner ? "text-white" : "opacity-40"
								) }
							>
								{ getBookDisplayString( book, game.config.type ) }
							</p>
							{ owner && (
								<motion.p
									className={ "text-xs text-white/80 truncate" }
									initial={ { opacity: 0, y: -4 } }
									animate={ { opacity: 1, y: 0 } }
									transition={ { delay: 0.2 } }
								>
									{ labelOf( owner ).toUpperCase() }
								</motion.p>
							) }
						</motion.div>
					);
				} ) }
			</div>
		</div>
	);
}
