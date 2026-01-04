import { Button } from "@s2h-ui/primitives/button";
import { MenuSquareIcon } from "@s2h-ui/primitives/icons";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@s2h-ui/primitives/sheet";
import { GameCode } from "@s2h-ui/shared/game-code";
import { useStore } from "@tanstack/react-store";
import { useBoolean } from "usehooks-ts";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayBoard } from "./display-board.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { DisplayPlayerInfo, PlayerLobby } from "./player-lobby.tsx";
import { store } from "./store.tsx";

export function DisplayGame() {
	const status = useStore( store, state => state.status );
	const playerId = useStore( store, state => state.playerId );
	const code = useStore( store, state => state.code );
	const { value, toggle } = useBoolean( false );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode
				code={ code }
				name={ "splendor" }
				actions={
					<Button size={ "icon" } className={ "w-8 h-8 md:h-10 md:w-10 lg:hidden" } onClick={ toggle }>
						<MenuSquareIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
				}
			/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3" }>
					<DisplayBoard/>
					<div className={ "hidden lg:block" }>
						<PlayerLobby mode={ "screen" }/>
					</div>
				</div>
				{ status === "COMPLETED" && <GameCompleted/> }
				{ !!playerId && (
					<div className={ "lg:hidden" }>
						<DisplayPlayerInfo playerId={ playerId }/>
					</div>
				) }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
			<Sheet open={ value } onOpenChange={ toggle }>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Player Lobby</SheetTitle>
						<SheetDescription/>
					</SheetHeader>
					<div className="grid flex-1 auto-rows-min gap-6 px-4 pb-4 overflow-scroll">
						<PlayerLobby/>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}