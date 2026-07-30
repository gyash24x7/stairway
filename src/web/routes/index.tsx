import { GAME_NAMES } from "@/contract/registry";
import { Logo } from "@/ui/components/logo";
import { Button } from "@/ui/primitives/button";
import { cn } from "@/ui/utils/cn";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute( "/" )( {
	component: () => (
		<div
			className={ cn(
				"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
				"gap-2 md:gap-4 w-full max-w-6xl"
			) }
		>
			{ GAME_NAMES.map( game => (
				<div
					key={ game }
					className={ cn(
						"cursor-pointer overflow-hidden relative card h-64 md:h-96",
						"rounded-md flex flex-col justify-between backgroundImage",
						"bg-cover border-2 flex-1 font-heading border-inverted-surface",
						"bg-background"
					) }
				>
					<div className={ "flex flex-col gap-4 px-6 py-3 mt-6" }>
						<h1 className={ `text-4xl text-accent font-title` }>
							{ game.toUpperCase() }
						</h1>
					</div>
					<Logo
						url={ `/logos/${ game }.svg` }
						classname={ "md:w-56 md:h-56 w-40 h-40 bg-accent absolute -bottom-6 -left-6 -rotate-6" }
					/>
					<div className={ "flex justify-end items-end p-6 mt-auto" }>
						<Link to={ `/${ game }` }>
							<Button>
								<span>PLAY</span>
							</Button>
						</Link>
					</div>
				</div>
			) ) }
		</div>
	)
} );
