import { cn } from "cn";
import { Link } from "react-router";

import { Logo } from "@/shared/shell/logo";

/**
 * The games with a route registered in `apps/web`. A tile here with no route
 * behind it lands on the router's error element, so a game joins this list when
 * its UI package does.
 */
const GAME_NAMES = [
	"fish",
	"callbreak",
	"coup",
	"wordle",
	"tictactoe",
	"splendor",
	"kingdomino"
] as const;

export function LandingPage() {
	return (
		<div
			className={ cn(
				"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
				"gap-2 md:gap-4 w-full max-w-6xl"
			) }
		>
			{ GAME_NAMES.map( game => (
				<Link
					key={ game }
					to={ `/${ game }` as string }
					className={ cn(
						"overflow-hidden relative h-64 md:h-96 group",
						"rounded-md flex flex-col justify-between",
						"border-2 flex-1 font-heading border-outline bg-background",
						"shadow-sm md:shadow-md transition-all",
						"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
					) }
				>
					<div className={ "flex flex-col gap-4 px-6 py-3 mt-6" }>
						<h1 className={ "text-4xl text-accent font-title" }>
							{ game.toUpperCase() }
						</h1>
					</div>
					<Logo
						url={ `/logos/${ game }.svg` }
						classname={ "md:w-56 md:h-56 w-40 h-40 bg-accent absolute -bottom-6 -left-6 -rotate-6" }
					/>
					<div className={ "flex justify-end items-end p-6 mt-auto" }>
						<span
							className={ cn(
								"inline-flex items-center justify-center rounded-base",
								"text-neutral-dark bg-accent border-2 border-outline",
								"px-4 py-2 text-sm font-base"
							) }
						>
							PLAY
						</span>
					</div>
				</Link>
			) ) }
		</div>
	);
}
