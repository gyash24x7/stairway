"use client";

import { DeclareDealWins } from "@/callbreak/components/declare-deal-wins";
import { PlayCard } from "@/callbreak/components/play-card";
import { addBots } from "@/callbreak/server/functions";
import { store } from "@/callbreak/store";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { Fragment, useTransition } from "react";

export function ActionPanel() {
	const [ isPending, startTransition ] = useTransition();

	const status = useStore( store, state => state.game.status );
	const playerId = useStore( store, state => state.playerId );
	const round = useStore( store, state => state.currentRound );
	const deal = useStore( store, state => state.currentDeal );
	const gameId = useStore( store, state => state.game.id );

	const handleClick = () => startTransition( async () => {
		const { error } = await addBots( gameId );
		if ( !!error ) {
			alert( error );
		}
	} );

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-white border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "CREATED" && (
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "ADD BOTS" }
					</Button>
				) }
				{ status === "IN_PROGRESS" && !!deal && (
					<Fragment>
						{ deal.status === "CREATED" && deal.playerOrder[ deal.turnIdx ] === playerId && (
							<DeclareDealWins/>
						) }
						{ deal.status === "IN_PROGRESS" && !!round && !round.completed && (
							<Fragment>
								{ playerId === round.playerOrder[ round.turnIdx ] && <PlayCard/> }
							</Fragment>
						) }
					</Fragment>
				) }
			</div>
		</div>
	);
}