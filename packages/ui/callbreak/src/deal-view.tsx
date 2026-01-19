import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCard } from "@s2h-ui/shared/display-card";
import { DisplayPlayer } from "@s2h-ui/shared/display-player";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import { HandView } from "./hand-view.tsx";
import { Scores } from "./scores.tsx";
import { store } from "./store.tsx";

export function DealView() {
	const currentTurn = useStore( store, state => state.currentTurn );
	const currentRound = useStore( store, state => state.currentRound );
	const players = useStore( store, state => state.players );
	const playerOrder = useStore( store, state => state.currentRound?.playerOrder
		?? state.currentDeal?.playerOrder
		?? Object.keys( state.players ) );

	return (
		<Fragment>
			<div className={ cn( "grid grid-cols-1 lg:grid-cols-2 gap-3" ) }>
				<Scores/>
				<div className={ "grid gap-3 grid-cols-2" }>
					{ playerOrder.map( ( playerId ) => {
						const cardId = currentRound?.cards[ playerId ];
						return (
							<div
								key={ playerId }
								className={ cn(
									"w-full flex gap-3 p-3 rounded-md items-center bg-background justify-between",
									!currentRound?.winner && currentTurn === playerId && "border-accent border-4",
									currentRound?.winner === playerId && "border-green-500 border-4"
								) }
							>
								<DisplayPlayer player={ players[ playerId ] } key={ playerId }/>
								{ cardId && <DisplayCard cardId={ cardId } focused/> }
								{ !cardId && !!currentRound && (
									<div
										className={ cn(
											"w-16 md:w-20 xl:w-24 p-1 md:p-1.5 md:text-lg h-24 md:h-30 xl:h-36",
											"rounded-lg border-2 bg-surface border-dotted border-gray-400",
											"flex flex-col justify-between"
										) }
									/>
								) }
							</div>
						);
					} ) }
				</div>
			</div>
			<HandView/>
		</Fragment>
	);
}