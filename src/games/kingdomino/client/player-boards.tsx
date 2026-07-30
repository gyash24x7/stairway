import { LayoutDashboardIcon } from "lucide-react";
import { useBoolean } from "usehooks-ts";

import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { RSmallBoard } from "@/games/kingdomino/client/board.tsx";
import { useKingdomino } from "@/games/kingdomino/client/context.tsx";

export function PlayerBoards() {
	const { value, setTrue, toggle } = useBoolean();
	const { data } = useKingdomino();
	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<Button onClick={ setTrue }>
				<LayoutDashboardIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
				<span>VIEW&nbsp;BOARDS</span>
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>BOARDS</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "p-4 overflow-y-auto flex flex-col" }>
					{ data.context.players.filter( pid => pid !== data.view.playerId ).map( pid => (
						<div key={ pid } className={ "flex flex-col gap-2 items-center" }>
							<h2>{ `${ data.players[ pid ].name.toUpperCase() }'s BOARD` }</h2>
							<RSmallBoard board={ data.view.playerData[ pid ].board }/>
						</div>
					) ) }
				</div>
			</DrawerContent>
		</Drawer>
	);
}
