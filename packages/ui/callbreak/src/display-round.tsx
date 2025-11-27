import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCard } from "@s2h-ui/shared/display-card";
import { DisplayPlayer } from "@s2h-ui/shared/display-player";
import type { PlayerData, Round } from "@s2h/callbreak/types";
import { getCardFromId } from "@s2h/cards/utils";
import { useStore } from "@tanstack/react-store";
import { store } from "./store";

type DisplayRoundProps = {
	round: Round;
	players: PlayerData;
	playerOrder: string[];
}

export function DisplayRound( { round, playerOrder, players }: DisplayRoundProps ) {
	const currentTurn = useStore( store, ( state ) => state.currentTurn );
	return (
		<div className={ "grid gap-3 grid-cols-4" }>
			{ playerOrder.map( ( playerId ) => {
				const cardId = round.cards[ playerId ]!;
				const card = !!cardId ? getCardFromId( cardId ) : undefined;
				return (
					<div
						key={ playerId }
						className={ cn(
							"w-full flex flex-col gap-3 p-3 rounded-md items-center border-2",
							!round.winner && currentTurn === playerId && "border-main border-4",
							round.winner === playerId && "border-green-500 border-4"
						) }
					>
						<DisplayPlayer player={ players[ playerId ] } key={ playerId }/>
						{ card && <DisplayCard cardId={ cardId } focused/> }
						{ !card && (
							<div
								className={ cn(
									"w-12 md:w-14 xl:w-16 p-1 md:p-1.5 xl:p-2 md:text-lg xl:text-xl",
									`rounded-lg flex flex-col justify-between border-2 bg-bg border-dotted`,
									"h-[88px] md:h-[104px] xl:h-[116px] bg-white"
								) }
							/>
						) }
					</div>
				);
			} ) }
		</div>
	);
}