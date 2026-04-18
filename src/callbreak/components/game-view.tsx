"use client";

import { ActionPanel } from "@/callbreak/components/action-panel";
import { useCallbreak } from "@/callbreak/components/context";
import { DealView } from "@/callbreak/components/deal-view";
import { addBots } from "@/callbreak/core/actions";
import { RCardSuit } from "@/shared/components/card";
import { GameInfo } from "@/shared/components/game-info";
import { RPlayerInfo } from "@/shared/components/player-info";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { Fragment, useTransition } from "react";

export function GameView() {
	const { game } = useCallbreak();
	const [ isPending, startTransition ] = useTransition();

	const handleAddBots = () => startTransition( () => addBots( { gameId: game.id } ) );

	return (
		<div className={ `flex flex-col gap-3 w-full max-w-6xl justify-self-center` }>
			<GameInfo
				code={ game.code }
				name={ "callbreak" }
				completed={ game.status === "COMPLETED" }
				additionalInfo={
					<Fragment>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>TRUMP</p>
							<RCardSuit suit={ game.config.trumpSuit } large themed/>
						</div>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>DEAL COUNT</p>
							<h1 className={ "text-2xl md:text-4xl font-heading" }>{ game.config.dealCount }</h1>
						</div>
					</Fragment>
				}
			/>
			<div className={ "flex flex-col gap-3 mb-52" }>
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
