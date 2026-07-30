"use client";

import type { Book } from "@s2h/schema/fish";
import { cn } from "@s2h/ui/utils/cn";
import { getBookDisplayString } from "@s2h/utils/fish";
import { motion } from "framer-motion";
import { useFish } from "./context";

export function BooksTracker() {
	const { data } = useFish();

	const bookOwners = new Map<Book, { teamName: string; teamId: string }>();
	for ( const team of Object.values( data.view.teams ) ) {
		for ( const book of team.booksWon ) {
			bookOwners.set( book, { teamName: team.name, teamId: team.id } );
		}
	}

	const teamIds = Object.keys( data.view.teams );
	const teamColors = [ "bg-accent", "bg-blue-500", "bg-purple-500", "bg-orange-500" ];

	const getTeamColor = ( teamId: string ) => {
		const idx = teamIds.indexOf( teamId );
		return teamColors[ idx ] ?? "bg-accent";
	};

	return (
		<div className={ "bg-background rounded-md p-3 md:p-4 w-full" }>
			<h2 className={ "text-sm md:text-base font-semibold mb-3" }>BOOKS WON</h2>
			<div className={ "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2" }>
				{ data.config.books.map( book => {
					const owner = bookOwners.get( book );
					return (
						<motion.div
							key={ book }
							layout
							animate={ owner
								? {
									backgroundColor: undefined,
									scale: [ 1, 1.08, 1 ],
									transition: { duration: 0.6 }
								}
								: { scale: 1 }
							}
							className={ cn(
								"rounded-md px-2 py-2 text-center",
								owner ? getTeamColor( owner.teamId ) : "bg-surface"
							) }
						>
							<p
								className={ cn(
									"text-sm md:text-base font-bold",
									owner ? "text-white" : "opacity-40"
								) }
							>
								{ getBookDisplayString( book, data.config.type ) }
							</p>
							{ owner && (
								<motion.p
									className={ "text-xs text-white/80 truncate" }
									initial={ { opacity: 0, y: -4 } }
									animate={ { opacity: 1, y: 0 } }
									transition={ { delay: 0.2 } }
								>
									{ owner.teamName.toUpperCase() }
								</motion.p>
							) }
						</motion.div>
					);
				} ) }
			</div>
		</div>
	);
}
