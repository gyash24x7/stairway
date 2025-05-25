import type { Callbreak } from "@/callbreak/types";
import { DisplayCard } from "@/shared/components/display-card";
import { DisplayPlayer } from "@/shared/components/display-player";
import { getCardFromId } from "@/libs/cards/card";
import { cn } from "@/shared/utils/cn";

type DisplayRoundProps = {
	round: Callbreak.Round;
	players: Callbreak.PlayerData;
	playerOrder: string[];
}

export function DisplayRound( { round, playerOrder, players }: DisplayRoundProps ) {
	return (
		<div className={ "grid gap-3 grid-cols-4" }>
			{ playerOrder.map( ( playerId, i ) => {
				const cardId = round.cards[ playerId ]!;
				const card = !!cardId ? getCardFromId( cardId ) : undefined;
				return (
					<div
						key={ playerId }
						className={ cn(
							"w-full flex flex-col gap-3 p-3 rounded-md items-center border-2",
							round.turnIdx === i && "border-main border-4"
						) }
					>
						<DisplayPlayer player={ players[ playerId ] } key={ playerId }/>
						{ card && <DisplayCard rank={ card.rank } suit={ card.suit } focused/> }
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