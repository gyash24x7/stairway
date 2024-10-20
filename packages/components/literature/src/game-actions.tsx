"use client";

import {
	addBots,
	askCard,
	callSet,
	createGame,
	createTeams,
	executeBotMove,
	joinGame,
	startGame,
	transferTurn
} from "@stairway/api/literature";
import { Button, Spinner } from "@stairway/components/base";
import { redirect } from "next/navigation";
import { useTransition } from "react";

type GameIdProps = { gameId: string };

export function CreateGame() {
	const [ isPending, startTransition ] = useTransition();
	const createGameFn = () => startTransition( async () => {
		const game = await createGame();
		redirect( `/literature/${ game.id }` );
	} );

	return (
		<Button onClick={ createGameFn } disabled={ isPending }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}

export function JoinGame( { code }: { code: string } ) {
	const [ isPending, startTransition ] = useTransition();
	const joinGameFn = () => startTransition( async () => {
		const game = await joinGame( code );
		redirect( `/literature/${ game.id }` );
	} );

	return (
		<Button onClick={ joinGameFn } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "JOIN GAME" }
		</Button>
	);
}

export const AddBots = ( { gameId }: GameIdProps ) => {
	const [ isPending, startTransition ] = useTransition();
	const addBotsFn = () => startTransition( async () => {
		await addBots( gameId );
	} );

	return (
		<Button onClick={ addBotsFn } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
};

export type CreateTeamsProps = GameIdProps & {
	playerCount: number;
	data: Record<string, string[]>;
	onSubmit: () => void;
}

export function CreateTeams( { gameId, data, onSubmit, playerCount }: CreateTeamsProps ) {
	const [ isPending, startTransition ] = useTransition();
	const createTeamsFn = () => startTransition( async () => {
		await createTeams( gameId, data );
		onSubmit();
	} );

	const isDisabled = isPending
		|| Object.keys( data ).length !== 2
		|| Object.values( data ).flat().length !== playerCount;

	return (
		<Button onClick={ createTeamsFn } disabled={ isDisabled } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "CREATE TEAMS" }
		</Button>
	);
}

export const StartGame = ( { gameId }: GameIdProps ) => {
	const [ isPending, startTransition ] = useTransition();
	const startGameFn = () => startTransition( async () => {
		await startGame( gameId );
	} );

	return (
		<Button onClick={ startGameFn } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "START GAME" }
		</Button>
	);
};

export const ExecuteBotMove = ( { gameId }: GameIdProps ) => {
	const [ isPending, startTransition ] = useTransition();
	const executeBotMoveFn = () => startTransition( async () => {
		await executeBotMove( gameId );
	} );

	return (
		<Button onClick={ executeBotMoveFn } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "EXECUTE BOT MOVE" }
		</Button>
	);
};

export type AskCardProps = GameIdProps & {
	from: string;
	card: string;
	onSubmit: () => void;
}

export function AskCard( { gameId, card, from, onSubmit }: AskCardProps ) {
	const [ isPending, startTransition ] = useTransition();
	const askCardFn = () => startTransition( async () => {
		await askCard( gameId, from, card );
		onSubmit();
	} );

	return (
		<Button onClick={ askCardFn } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "ASK CARD" }
		</Button>
	);
}

export type CallSetProps = GameIdProps & {
	data: Record<string, string>;
	onSubmit: () => void;
}

export function CallSet( { gameId, data, onSubmit }: CallSetProps ) {
	const [ isPending, startTransition ] = useTransition();
	const callSetFn = () => startTransition( async () => {
		await callSet( gameId, data );
		onSubmit();
	} );

	return (
		<Button onClick={ callSetFn } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "CALL SET" }
		</Button>
	);
}

export type TransferTurnProps = GameIdProps & {
	transferTo: string;
	onSubmit: () => void;
}

export function TransferTurn( { gameId, transferTo, onSubmit }: TransferTurnProps ) {
	const [ isPending, startTransition ] = useTransition();
	const transferTurnFn = () => startTransition( async () => {
		await transferTurn( gameId, transferTo );
		onSubmit();
	} );

	return (
		<Button onClick={ transferTurnFn } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "TRANSFER TURN" }
		</Button>
	);
}