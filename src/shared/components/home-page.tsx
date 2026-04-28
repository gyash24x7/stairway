import { Logo } from "@/shared/components/logo";
import { Button } from "@/shared/primitives/button";
import { cn } from "@/shared/utils/cn";

export function HomePage() {
	const games = [
		"fish",
		"callbreak",
		"wordle",
		"tic-tac-toe",
		"splendor",
		"kingdomino"
	];

	return (
		<div
			className={ cn(
				"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
				"gap-2 md:gap-4 w-full max-w-6xl"
			) }
		>
			{ games.map( game => (
				<div
					key={ game }
					className={ cn(
						"cursor-pointer overflow-hidden relative card h-64 md:h-96",
						"rounded-md flex flex-col justify-between backgroundImage",
						"bg-cover border-2 flex-1 font-heading border-inverted-surface",
						`${ game }-bg`
					) }
				>
					<div className={ "flex flex-col gap-4 px-6 py-3 mt-6" }>
						<h1 className={ `text-4xl z-10 text-accent font-title` }>
							{ game.toUpperCase() }
						</h1>
					</div>
					<Logo
						url={ `/logos/${ game }.svg` }
						classname={ "md:w-56 md:h-56 w-40 h-40 bg-accent absolute -bottom-6 -left-6 -rotate-6" }
					/>
					<div className={ "flex justify-end items-end z-10 p-6 mt-auto" }>
						<a href={ `/${ game }` } rel={ "noopener noreferrer" }>
							<Button>
								<span>PLAY</span>
							</Button>
						</a>
					</div>
				</div>
			) ) }
		</div>
	);
}