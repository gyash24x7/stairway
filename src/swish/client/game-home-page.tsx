import type { ReactNode } from "react";

import { Login } from "@/auth/client/login.tsx";
import { Separator } from "@/shared/ui/primitives/separator.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { JoinGame } from "@/swish/client/join-game.tsx";

import type { GameRef, JoinGameInput } from "@/swish/shared/schema.ts";

export type GameHomePageProps = {
	/** The route segment and the name in the heading — `"tictactoe"`, `"fish"`. */
	game: string;
	/** The heading, when the game's display name isn't just its slug upper-cased. */
	title?: string;
	/** One or two paragraphs on what the game is. */
	blurb: ReactNode;
	/** The long-form rules, shown below the fold. */
	rules?: ReactNode;
	/** The game's own create panel, which carries its config controls. */
	createGame: ReactNode;
	joinGame: ( input: JoinGameInput ) => Promise<GameRef>;
	isLoggedIn?: boolean;
};

/**
 * The page behind `/<game>`: what the game is, how to start or join one, and the
 * rules.
 *
 * Six copies of this had drifted apart in their breakpoints and their signed-out
 * state, so the layout lives here and a game supplies only what is actually its
 * own — the prose and its create panel.
 */
export function GameHomePage( props: GameHomePageProps ) {
	return (
		<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ "text-4xl font-heading" }>{ props.title ?? props.game.toUpperCase() }</h2>
			{ props.blurb }
			<Separator/>
			{ props.isLoggedIn
				? (
					<div className={ "grid grid-cols-1 md:grid-cols-2 gap-5 w-full" }>
						{ props.createGame }
						<JoinGame game={ props.game } joinGame={ props.joinGame }/>
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
						<Login/>
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
