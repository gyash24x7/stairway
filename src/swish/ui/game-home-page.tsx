import { cn } from "cn";
import type { ReactNode } from "react";

import { OpenTables } from "@/lobby/ui/open-tables";
import { Separator } from "@/shared/primitives/separator";


export type GameHomePageProps = {
	game: string;
	title?: string;
	blurb: ReactNode;
	rules?: ReactNode;
	createGame: ReactNode;
	isLoggedIn?: boolean;
};

/**
 * The page behind `/<game>`: what the game is, how to start or join one, and the
 * rules.
 *
 * Six copies of this had drifted apart in their breakpoints and their signed-out
 * state, so the layout lives here and a game supplies only what is actually its
 * own — the prose and its create panel.
 *
 * The open-tables list is built here rather than passed in, for the same
 * reason: it is the same list on every game's page, and `props.game` is all it
 * needs to narrow itself. It sits beside the create panel in the two-column
 * grid because the two are one question — open a table, or take a seat at one
 * somebody else opened — and a visitor who has to scroll to find the second has
 * effectively only been offered the first.
 */
export function GameHomePage( props: GameHomePageProps ) {
	return (
		<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ "text-4xl font-heading" }>{ props.title ?? props.game.toUpperCase() }</h2>
			{ props.blurb }
			<Separator/>
			{ props.isLoggedIn
				? (
					<div className={ "grid grid-cols-1 md:grid-cols-2 gap-5 w-full items-start" }>
						{ props.createGame }
						<OpenTables game={ props.game }/>
					</div>
				)
				: (
					<div
						className={ cn(
							"rounded-md bg-background border-2 border-outline p-6",
							"flex flex-col gap-4 items-center text-center shadow-sm md:shadow-md"
						) }
					>
						<h3 className={ "text-xl font-heading" }>SIGN IN TO PLAY</h3>
						<p className={ "text-sm text-muted-foreground" }>
							You need an account to create or join a game.
						</p>
					</div>
				) }
			{ !!props.rules && (
				<>
					<Separator/>
					<h2 className={ "text-xl font-heading" }>RULES</h2>
					{ props.rules }
				</>
			) }
		</div>
	);
}
