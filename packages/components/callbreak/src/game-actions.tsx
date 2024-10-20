"use client";

import { addBots, createGame, declareDealWins, joinGame, playCard } from "@stairway/api/callbreak";
import { Button, Spinner } from "@stairway/components/base";
import { redirect } from "next/navigation";
import { useTransition } from "react";

type GameIdProps = { gameId: string };
type DealIdProps = GameIdProps & { dealId: string };
type RoundIdProps = DealIdProps & { roundId: string };

type CreateGameProps = { trumpSuit: string; dealCount?: 5 | 9 | 13 }

export function CreateGame( { trumpSuit, dealCount = 5 }: CreateGameProps ) {
	const [ isPending, startTransition ] = useTransition();
	const createGameFn = () => startTransition( async () => {
		const game = await createGame( { trumpSuit, dealCount } );
		redirect( `/callbreak/${ game.id }` );
	} );

	return (
		<Button onClick={ createGameFn } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}

export function JoinGame( { code }: { code: string } ) {
	const [ isPending, startTransition ] = useTransition();
	const joinGameFn = () => startTransition( async () => {
		const game = await joinGame( code );
		redirect( `/callbreak/${ game.id }` );
	} );

	return (
		<Button onClick={ joinGameFn } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "JOIN GAME" }
		</Button>
	);
}

export function AddBots( { gameId }: { gameId: string } ) {
	const [ isPending, startTransition ] = useTransition();
	const addBotsFn = () => startTransition( async () => {
		await addBots( gameId );
	} );

	return (
		<Button onClick={ addBotsFn } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}

export type DeclareDealWinsProps = DealIdProps & {
	wins: number;
	onSubmit: () => void;
}

export function DeclareDealWins( { gameId, dealId, wins, onSubmit }: DeclareDealWinsProps ) {
	const [ isPending, startTransition ] = useTransition();
	const declareWinsFn = () => startTransition( async () => {
		await declareDealWins( { gameId, dealId, wins } );
		onSubmit();
	} );

	return (
		<Button onClick={ declareWinsFn } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "DECLARE WINS" }
		</Button>
	);
}

export type PlayCardProps = RoundIdProps & {
	cardId: string;
	onSubmit: () => void;
}

export function PlayCard( { gameId, dealId, roundId, cardId, onSubmit }: PlayCardProps ) {
	const [ isPending, startTransition ] = useTransition();
	const playCardFn = () => startTransition( async () => {
		await playCard( { gameId, dealId, roundId, cardId } );
		onSubmit();
	} );

	return (
		<Button onClick={ playCardFn } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "PLAY CARD" }
		</Button>
	);
}