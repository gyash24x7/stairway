import { cn } from "@base/components";
import { useIsGameCompleted } from "@wordle/store";
import { GuessBlocks, GuessDiagramBlocks } from "./guess-blocks";
import { Keyboard } from "./keyboard";

export function GamePage() {
	const isGameCompleted = useIsGameCompleted();

	return (
		<div className={ `flex flex-col items-center mb-20` }>
			<h1 className={ cn( "text-4xl my-3" ) }>WORDLE</h1>
			{ isGameCompleted && (
				<div className={ "flex flex-col gap-12 items-center" }>
					<h1 className={ "text-4xl font-fjalla text-green-600" }>Game Completed</h1>
					<GuessDiagramBlocks/>
					<div
						className={ cn(
							"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
							"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
						) }
					>
						<a href={ "/wordle" }>
							<h2>TRY AGAIN?</h2>
						</a>
					</div>
				</div>
			) }
			{ !isGameCompleted && (
				<div>
					<GuessBlocks/>
					<div
						className={ cn(
							"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
							"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
						) }
					>
						<Keyboard/>
					</div>
				</div>
			) }
		</div>
	);
}