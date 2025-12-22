import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCard } from "@s2h-ui/shared/display-card";
import { DisplayPlayer } from "@s2h-ui/shared/display-player";
import type { PlayerData, Round } from "@s2h/callbreak/types";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";

type DisplayRoundProps = {
	round: Round;
	players: PlayerData;
	playerOrder: string[];
}

export function DisplayRound( { round, playerOrder, players }: DisplayRoundProps ) {
	const currentTurn = useStore( store, ( state ) => state.currentTurn );
	return (
		<div className={ "grid gap-3 grid-cols-2" }>
			{ playerOrder.map( ( playerId ) => {
				const cardId = round.cards[ playerId ];
				return (
					<div
						key={ playerId }
						className={ cn(
							"w-full flex gap-3 p-3 rounded-md items-center border-2",
							!round.winner && currentTurn === playerId && "border-main border-4",
							round.winner === playerId && "border-green-500 border-4"
						) }
					>
						<DisplayPlayer player={ players[ playerId ] } key={ playerId }/>
						{ cardId && <DisplayCard cardId={ cardId } focused/> }
						{ !cardId && (
							<div className={ "flex-1" }>
								<div
									className={ cn(
										"w-16 md:w-20 p-1 md:p-1.5 md:text-lg",
										`rounded-lg flex flex-col justify-between border-2 bg-bg border-dotted`,
										"h-24 md:h-30 bg-secondary-background"
									) }
								/>
							</div>
						) }
					</div>
				);
			} ) }
		</div>
	);
}