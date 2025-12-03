import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { DeclareDealWins } from "./declare-deal-wins.tsx";
import { PlayCard } from "./play-card.tsx";
import { store } from "./store.tsx";

export function ActionPanel() {
	const status = useStore( store, state => state.status );
	const playerId = useStore( store, state => state.playerId );
	const currentTurn = useStore( store, state => state.currentTurn );

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-white border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "CARDS_DEALT" && currentTurn === playerId && <DeclareDealWins/> }
				{ status === "ROUND_STARTED" && currentTurn === playerId && <PlayCard/> }
			</div>
		</div>
	);
}