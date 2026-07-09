import { RSmallBoard } from "./board";
import { useKingdomino } from "./context";
import { Button } from "@s2h/ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { LayoutDashboardIcon } from "lucide-react";
import { useBoolean } from "usehooks-ts";

export function PlayerBoards() {
	const { value, setTrue, toggle } = useBoolean();
	const { shared, player } = useKingdomino();
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
					{ shared.context.players.filter( pid => pid !== player.playerId ).map( pid => (
						<div key={ pid } className={ "flex flex-col gap-2 items-center" }>
							<h2>{ `${ shared.players[ pid ].name.toUpperCase() }'s BOARD` }</h2>
							<RSmallBoard board={ shared.state.playerData[ pid ].board }/>
						</div>
					) ) }
				</div>
			</DrawerContent>
		</Drawer>
	);
}
