import { Button } from "@/shared/primitives/button";
import { cn } from "@/shared/utils/cn";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/" )( {
	component: () => (
		<div
			className={ "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 w-full max-w-6xl justify-self-center" }>
			{ [ "fish", "callbreak", "wordle", "tictactoe", "splendor", "kingdomino" ].map( game => (
				<div
					key={ game }
					className={ cn(
						"cursor-pointer overflow-hidden relative card h-64 md:h-96 rounded-md flex flex-col",
						`justify-between backgroundImage ${ game }-bg bg-cover border-2 flex-1`,
						"font-heading border-gray-400"
					) }
				>
					<div
						className={ cn(
							"absolute w-full h-full top-0 left-0 transition duration-300",
							"bg-background"
						) }
					/>
					<div className={ "text-accent font-title px-6 py-3 mt-6" }>
						<h1 className={ `text-4xl relative z-10` }>
							{ game.toUpperCase() }
						</h1>
					</div>
					<div className={ "flex justify-end z-10 p-6" }>
						<a href={ `/${ game }` } rel={ "noopener noreferrer" }>
							<Button>PLAY</Button>
						</a>
					</div>
				</div>
			) ) }
		</div>
	)
} );
