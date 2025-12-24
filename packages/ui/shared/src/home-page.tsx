import { Button } from "@s2h-ui/primitives/button";
import { cn } from "@s2h-ui/primitives/utils";
import { useNavigate } from "@tanstack/react-router";

export function HomePage() {
	const navigate = useNavigate();
	const navigateToGame = ( game: string ) => navigate( { to: "/" + game } );
	return (
		<div className={ "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2 md:gap-4" }>
			{ [ "fish", "callbreak", "wordle" ].map( game => (
				<div
					key={ game }
					className={ cn(
						"cursor-pointer overflow-hidden relative card h-64 md:h-96 rounded-md flex flex-col",
						`justify-between backgroundImage ${ game }-bg bg-cover border-2 flex-1`,
						"font-heading"
					) }
				>
					<div
						className={ cn(
							"absolute w-full h-full top-0 left-0 transition duration-300",
							"bg-accent/30"
						) }
					/>
					<div className={ "text-foreground px-6 py-3 mt-6" }>
						<h1 className={ `text-5xl relative z-10` }>
							{ game.toUpperCase() }
						</h1>
					</div>
					<div className={ "flex justify-end z-10 p-6" }>
						<Button onClick={ () => navigateToGame( game ) }>PLAY</Button>
					</div>
				</div>
			) ) }
		</div>
	);
}