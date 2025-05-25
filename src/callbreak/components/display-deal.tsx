import { DisplayRound } from "@/callbreak/components/display-round";
import { store } from "@/callbreak/store";
import { DisplayPlayer } from "@/shared/components/display-player";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";

export function DisplayDeal() {
	const deal = useStore( store, state => state.currentDeal );
	const round = useStore( store, state => state.currentRound! );
	const players = useStore( store, state => state.players );
	const playerOrder = useStore( store, state => state.currentRound?.playerOrder
		?? state.currentDeal?.playerOrder
		?? Object.keys( state.players ) );

	if ( deal?.status !== "IN_PROGRESS" ) {
		return (
			<div className={ "grid gap-3 grid-cols-4" }>
				{ playerOrder.map( ( playerId, idx ) => (
					<div
						key={ playerId }
						className={ cn(
							"w-full flex flex-col gap-3 rounded-md items-center border-2",
							deal?.turnIdx === idx && "border-main border-4"
						) }
					>
						<DisplayPlayer
							player={ players[ playerId ] }
							key={ playerId }
							withDeclaration={ deal?.status !== "COMPLETED" }
							declaration={ deal?.declarations[ playerId ] }
						/>
					</div>
				) ) }
			</div>
		);
	}

	if ( !!round ) {
		return <DisplayRound round={ round! } players={ players } playerOrder={ playerOrder }/>;
	}

	return <Fragment/>;
}