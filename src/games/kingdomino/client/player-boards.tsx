"use client";

import { LayoutDashboardIcon } from "lucide-react";
import { useBoolean } from "usehooks-ts";

import { RSmallBoard } from "@/games/kingdomino/client/board.tsx";
import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export function PlayerBoards() {
	const { value, setTrue, toggle } = useBoolean();
	const { data, playerId } = useKingdomino();

	// Every seat, own board first: the drawer is for comparing kingdoms, and
	// comparing them against yours is the whole reason to open it.
	const ordered = [
		...data.context.players.filter( pid => pid === playerId ),
		...data.context.players.filter( pid => pid !== playerId )
	];

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<Button onClick={ setTrue } title={ "See every kingdom" }>
				<LayoutDashboardIcon className={ "w-4 h-4" }/>
				<span>BOARDS</span>
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>EVERY KINGDOM</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div
					className={ cn(
						"px-4 pb-4 w-full overflow-y-auto max-h-[70vh]",
						"grid grid-cols-1 lg:grid-cols-2 gap-4 justify-items-center"
					) }
				>
					{ ordered.map( pid => {
						const seat = data.view.playerData[ pid ];
						if ( !seat ) {
							return null;
						}

						return (
							<div
								key={ pid }
								className={ cn(
									"flex flex-col gap-2 items-center w-full",
									"bg-surface rounded-md p-3",
									pid === playerId && "border-2 border-accent"
								) }
							>
								<div className={ "flex items-baseline gap-2" }>
									<h2 className={ "font-heading" }>
										{ pid === playerId
											? "YOUR KINGDOM"
											: ( data.players[ pid ]?.name ?? "" ).toUpperCase() }
									</h2>
									<span className={ "text-sm text-muted-foreground" }>
										{ seat.score.points ?? 0 } PTS
									</span>
								</div>
								{ /* Its own scroll area, so a big kingdom overflows sideways
								     rather than being squeezed down to fit the tile. */ }
								<div className={ "w-full overflow-x-auto flex justify-center" }>
									<RSmallBoard board={ seat.board } size={ "md" }/>
								</div>
							</div>
						);
					} ) }
				</div>
			</DrawerContent>
		</Drawer>
	);
}
