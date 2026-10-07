import { useAtomSet, useAtomValue } from "@effect/atom-react";

import type { Card, Noble as NobleType } from "@/games/splendor/schema";
import { claimNobleAtom } from "@/games/splendor/ui/client";
import { RNoble } from "@/games/splendor/ui/noble";
import { qualifyingNobles } from "@/games/splendor/utils";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { GameId } from "@/swish/schema";


export type ClaimNobleProps = {
	gameId: string;
	awaiting: boolean;

	/**
	 * The window this answer is for.
	 *
	 * Sent with the response and checked against the one that is open. The race
	 * it closes is quick: a purchase can settle this window and open the next in
	 * the same commit, so a tap made against the frame on screen can land while
	 * its successor is open. Naming it turns that into a refusal rather than an
	 * answer to a question nobody read.
	 */
	frameId?: string;
	myCards: ReadonlyArray<Card>;
	nobles: ReadonlyArray<NobleType>;
};

/**
 * The noble choice, when a purchase leaves more than one willing to visit.
 *
 * Opened by the engine rather than by the player: a purchase that leaves two or
 * more nobles willing opens the window, so this appears on its own and cannot be
 * dismissed — the table is held up until it is answered, or the frame's clock
 * runs out and the seat is answered for.
 */
export function ClaimNoble( { gameId, awaiting, frameId, myCards, nobles }: ClaimNobleProps ) {
	const claimNoble = useAtomSet( claimNobleAtom, { mode: "promiseExit" } );
	const isPending = useAtomValue( claimNobleAtom ).waiting;

	if ( !awaiting ) {
		return null;
	}

	const willing = qualifyingNobles( myCards, nobles );

	return (
		<Drawer open dismissible={ false }>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>CHOOSE A NOBLE</DrawerTitle>
					<DrawerDescription>
						More than one is willing to visit. Pick the one that comes.
					</DrawerDescription>
				</DrawerHeader>
				<div className={ "px-4 flex gap-3 flex-wrap justify-center overflow-y-scroll max-h-100" }>
					{ willing.map( noble => (
						<button
							key={ noble.id }
							onClick={ () => void claimNoble( {
								params: { gameId: GameId.make( gameId ) },
								query: frameId ? { frame: frameId } : {},
								payload: { nobleId: noble.id }
							} ) }
							disabled={ isPending }
							className={ "cursor-pointer disabled:opacity-50" }
						>
							<RNoble noble={ noble }/>
						</button>
					) ) }
				</div>
				<DrawerFooter>
					{ willing.length === 0 && (
						<Button disabled>NO NOBLE IS WILLING</Button>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
