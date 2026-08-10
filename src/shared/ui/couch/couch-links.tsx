"use client";

import { Link } from "@tanstack/react-router";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";

import { Button } from "@/shared/ui/primitives/button.tsx";

/**
 * The games that ship a couch/controller pair, mapped to their concrete route
 * ids. The router's `Link` needs a literal path, so this is a table rather than a
 * template — which also means adding a game here won't typecheck until its routes
 * actually exist.
 */
const COUCH_ROUTES = {
	splendor: {
		couch: "/splendor/$gameId/couch",
		controller: "/splendor/$gameId/controller"
	},
	callbreak: {
		couch: "/callbreak/$gameId/couch",
		controller: "/callbreak/$gameId/controller"
	},
	kingdomino: {
		couch: "/kingdomino/$gameId/couch",
		controller: "/kingdomino/$gameId/controller"
	}
} as const;

/** Whether a game has a couch screen. */
export const hasCouchMode = ( game: string ): game is keyof typeof COUCH_ROUTES =>
	game in COUCH_ROUTES;

export type CouchLinksProps = {
	/** The game's folder name, e.g. `"splendor"`. */
	game: string;
	gameId: string;
};

/**
 * The handoff: put the board on the television, and turn this phone into a
 * controller. Renders nothing for games with no couch screen yet.
 */
export function CouchLinks( { game, gameId }: CouchLinksProps ) {
	if ( !hasCouchMode( game ) ) {
		return null;
	}

	const routes = COUCH_ROUTES[ game ];

	return (
		<div className={ "flex gap-2 flex-wrap justify-end w-full" }>
			<Link to={ routes.couch } params={ { gameId } }>
				<Button variant={ "neutral" } className={ "flex gap-2 items-center" }>
					<MonitorIcon className={ "w-4 h-4" }/>
					<span>SHOW ON TV</span>
				</Button>
			</Link>
			<Link to={ routes.controller } params={ { gameId } }>
				<Button variant={ "neutral" } className={ "flex gap-2 items-center" }>
					<SmartphoneIcon className={ "w-4 h-4" }/>
					<span>CONTROLLER</span>
				</Button>
			</Link>
		</div>
	);
}
