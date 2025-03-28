"use client";

import { Button } from "@/components/base/button";
import { Spinner } from "@/components/base/spinner";
import { AskCard } from "@/components/literature/ask-card";
import { CallSet } from "@/components/literature/call-set";
import { CreateTeams } from "@/components/literature/create-teams";
import { PreviousAsks } from "@/components/literature/previous-asks";
import { TransferTurn } from "@/components/literature/transfer-turn";
import { addBots, executeBotMove, startGame } from "@/server/literature/functions";
import { store } from "@/stores/literature";
import { cn } from "@/utils/cn";
import { useStore } from "@tanstack/react-store";
import { Fragment, useTransition } from "react";

export function ActionPanel() {
	const [ isPending, startTransition ] = useTransition();

	const status = useStore( store, state => state.game.status );
	const currentTurn = useStore( store, state => state.game.currentTurn );
	const playerId = useStore( store, state => state.playerId );
	const players = useStore( store, state => state.players );
	const gameId = useStore( store, state => state.game.id );
	const isLastMoveSuccessfulCall = useStore( store, state => state.lastMoveData?.isCall
		&& state.lastMoveData?.move.success );

	const handleAddBots = () => startTransition( async () => {
		await addBots( { gameId } );
	} );

	const handleExecuteBotMove = () => startTransition( async () => {
		await executeBotMove( { gameId } );
	} );

	const handleStartGame = () => startTransition( async () => {
		await startGame( { gameId } );
	} );

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			{ status === "IN_PROGRESS" && (
				<div className={ "p-3 border-2 rounded-md w-full bg-bg max-w-lg" }>
					<p className={ "text-xl font-semibold" }>
						IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
					</p>
				</div>
			) }
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "CREATED" && playerId === currentTurn && (
					<Button onClick={ handleAddBots } disabled={ isPending } className={ "flex-1 max-w-lg" }>
						{ isPending ? <Spinner/> : "ADD BOTS" }
					</Button>
				) }
				{ status === "PLAYERS_READY" && playerId === currentTurn && <CreateTeams/> }
				{ status === "TEAMS_CREATED" && playerId === currentTurn && (
					<Button onClick={ handleStartGame } disabled={ isPending } className={ "flex-1 max-w-lg" }>
						{ isPending ? <Spinner/> : "START GAME" }
					</Button>
				) }
				{ status === "IN_PROGRESS" && (
					<Fragment>
						{ playerId === currentTurn && <AskCard/> }
						{ playerId === currentTurn && <CallSet/> }
						{ playerId === currentTurn && isLastMoveSuccessfulCall && <TransferTurn/> }
						{ players[ currentTurn ].isBot && (
							<Button
								onClick={ handleExecuteBotMove }
								disabled={ isPending }
								className={ "flex-1 max-w-lg" }
							>
								{ isPending ? <Spinner/> : "EXECUTE BOT MOVE" }
							</Button>
						) }
						<PreviousAsks/>
					</Fragment>
				) }
			</div>
		</div>
	);
}