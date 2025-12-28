import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import { PickTokens } from "./pick-tokens.tsx";
import { PurchaseCard } from "./purchase-card.tsx";
import { ReserveCard } from "./reserve-card.tsx";
import { StartGame } from "./start-game.tsx";
import { store } from "./store.tsx";

export function ActionPanel() {
	const status = useStore( store, state => state.status );
	const currentTurn = useStore( store, state => state.currentTurn );
	const createdBy = useStore( store, state => state.createdBy );
	const playerId = useStore( store, state => state.playerId );
	const players = useStore( store, state => state.players );
	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-background border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			{ status === "IN_PROGRESS" && (
				<div className={ "p-2 md:p-3 border-2 rounded-md w-full bg-bg max-w-lg" }>
					<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
						IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
					</p>
				</div>
			) }
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "PLAYERS_READY" && playerId === createdBy && <StartGame/> }
				{ status === "IN_PROGRESS" && (
					<Fragment>
						{ playerId === currentTurn && <PickTokens/> }
						{ playerId === currentTurn && <PurchaseCard/> }
						{ playerId === currentTurn && <ReserveCard/> }
					</Fragment>
				) }
			</div>
		</div>
	);
}