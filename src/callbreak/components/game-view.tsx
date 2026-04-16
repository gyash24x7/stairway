"use client";

import { ActionPanel } from "@/callbreak/components/action-panel";
import { useCallbreak } from "@/callbreak/components/context";
import { DealView } from "@/callbreak/components/deal-view";
import { Scores } from "@/callbreak/components/scores";
import { addBots } from "@/callbreak/core/actions";
import { RCardSuit } from "@/shared/components/card";
import { GameInfo } from "@/shared/components/game-info";
import { RPlayerInfo } from "@/shared/components/player-info";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

export function GameView() {
	const { game } = useCallbreak();
	const addBotsFn = useServerFn( addBots );
	const { isPending, mutate } = useMutation( { mutationFn: addBotsFn } );

	const handleAddBots = () => mutate( { data: { gameId: game.id } } );

	return (
		<div className={ `flex flex-col gap-3 w-full max-w-6xl justify-self-center` }>
			<GameInfo
				code={ game.code }
				name={ "callbreak" }
				completed={ game.status === "COMPLETED" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TRUMP</p>
						<RCardSuit suit={ game.config.trumpSuit } large themed/>
					</div>
				}
			/>
			<div className={ "flex flex-col gap-3 mb-52" }>
				{ game.status === "COMPLETED" && <Scores/> }
				{ game.state.activeDeal && <DealView/> }
				{ !game.state.activeDeal && (
					<div className={ "flex gap-3" }>
						{ Object.values( game.players ).map( player => (
							<div key={ player.id } className={ "min-w-1/4" }>
								<RPlayerInfo player={ player }/>
							</div>
						) ) }
					</div>
				) }
				{ game.status === "CREATED" && (
					<div className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
						<Spinner size={ "xl" }/>
						<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
							WAITING FOR PLAYERS
						</p>
						<Button onClick={ handleAddBots } disabled={ isPending }>
							{ isPending ? <Spinner/> : "ADD BOTS" }
						</Button>
					</div>
				) }
			</div>
			{ game.status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}
