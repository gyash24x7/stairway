"use client";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { Noble } from "@/games/splendor/client/noble.tsx";
import { qualifyingNobles } from "@/games/splendor/shared/utils.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";

/**
 * The noble choice, when a purchase leaves more than one willing to visit.
 *
 * Opened by the engine rather than by the player: the frame it settles is pushed
 * by `purchaseCard`, so this appears on its own and cannot be dismissed — the
 * table is held up until it is answered or the frame's clock runs out and the
 * engine picks the first willing noble.
 */
export function ClaimNoble() {
	const { data, playerId, awaitingNoble, claimNoble, isPending } = useSplendor();

	const me = playerId ? data.view.playerData[ playerId ] : undefined;
	if ( !awaitingNoble || !me ) {
		return null;
	}

	const willing = qualifyingNobles( me.cards, data.view.nobles );

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
							onClick={ () => claimNoble( { nobleId: noble.id } ) }
							disabled={ isPending }
							className={ "cursor-pointer disabled:opacity-50" }
						>
							<Noble noble={ noble }/>
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
