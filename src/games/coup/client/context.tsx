"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import type { ReactNode } from "react";

import { coupApi } from "@/games/coup/client/client.ts";
import {
	COUP_BLOCK_ACTION,
	COUP_CHALLENGE_ACTION,
	COUP_CHALLENGE_BLOCK,
	COUP_EXCHANGE,
	COUP_LOSE_INFLUENCE
} from "@/games/coup/shared/schema.ts";
import { legalActions, livingOpponents } from "@/games/coup/shared/utils.ts";

import type {
	BlockInput,
	ChallengeInput,
	CoupConfig,
	CoupView,
	ExchangeCardsInput,
	SurrenderInfluenceInput,
	TakeActionInput
} from "@/games/coup/shared/schema.ts";
import type {
	GameId,
	GameRef,
	GameView,
	InteractionFrame,
	PlayerId,
	RematchInput
} from "@/swish/shared/schema.ts";

/**
 * One context for all three screens.
 *
 * Coup's controls are driven by the interaction stack rather than by whose turn
 * it is: for most of a turn the table is waiting on somebody who is *not* the
 * current player. `awaiting` is that fact reduced to one value — the kind of
 * window open on this seat, or `undefined` when there is nothing to answer — and
 * every prompt in the UI keys off it.
 *
 * The shared screen has no `playerId`, so `awaiting` is always `undefined` there
 * and it renders the table without ever offering a control.
 */
type CoupContextValue = {
	data: GameView<CoupView, CoupConfig>;
	/** The viewing seat, absent on a shared screen. */
	playerId?: PlayerId;
	isMyTurn: boolean;
	/** The window this seat has to answer, if any. */
	awaiting?: typeof COUP_CHALLENGE_ACTION
		| typeof COUP_CHALLENGE_BLOCK
		| typeof COUP_BLOCK_ACTION
		| typeof COUP_LOSE_INFLUENCE
		| typeof COUP_EXCHANGE;
	/** The open frame, whoever it is waiting on. Drives the table's status line. */
	frame?: InteractionFrame;
	/** The actions this seat could declare, given what it is holding. */
	actions: ReturnType<typeof legalActions>;
	/** Everyone still in the game but this seat. */
	opponents: ReadonlyArray<PlayerId>;
	takeAction: ( input: TakeActionInput, onDone?: () => void ) => void;
	challenge: ( input: ChallengeInput ) => void;
	block: ( input: BlockInput ) => void;
	surrenderInfluence: ( input: SurrenderInfluenceInput ) => void;
	exchangeCards: ( input: ExchangeCardsInput ) => void;
	addBots: () => void;
	startGame: () => void;
	setAutoPlay: ( enabled: boolean ) => void;
	startRematch: ( input: RematchInput, onDone: ( ref: GameRef ) => void ) => void;
	isPending: boolean;
};

const CoupContext = createContext<CoupContextValue | null>( null );

export function useCoup() {
	const ctx = useContext( CoupContext );
	if ( !ctx ) {
		throw new Error( "useCoup must be used within a CoupProvider" );
	}
	return ctx;
}

type CoupProviderProps = {
	data: GameView<CoupView, CoupConfig>;
	gameId: GameId;
	children: ReactNode;
};

/** The kinds a seat can be asked to answer, narrowed off the open frame. */
const ANSWERABLE = [
	COUP_CHALLENGE_ACTION,
	COUP_CHALLENGE_BLOCK,
	COUP_BLOCK_ACTION,
	COUP_LOSE_INFLUENCE,
	COUP_EXCHANGE
] as const;

export function CoupProvider( { data, gameId, children }: CoupProviderProps ) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "coup", "getState", gameId ]
	} );

	const action = useMutation( {
		mutationFn: ( input: TakeActionInput ) => coupApi.takeAction( gameId, input ),
		onSuccess: invalidate
	} );

	const doubt = useMutation( {
		mutationFn: ( input: ChallengeInput ) => coupApi.challenge( gameId, input ),
		onSuccess: invalidate
	} );

	const stop = useMutation( {
		mutationFn: ( input: BlockInput ) => coupApi.block( gameId, input ),
		onSuccess: invalidate
	} );

	const surrender = useMutation( {
		mutationFn: ( input: SurrenderInfluenceInput ) =>
			coupApi.surrenderInfluence( gameId, input ),
		onSuccess: invalidate
	} );

	const exchange = useMutation( {
		mutationFn: ( input: ExchangeCardsInput ) => coupApi.exchangeCards( gameId, input ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => coupApi.addBots( gameId ),
		onSuccess: invalidate
	} );

	const start = useMutation( {
		mutationFn: () => coupApi.start( gameId ),
		onSuccess: invalidate
	} );

	const autoPlay = useMutation( {
		mutationFn: ( enabled: boolean ) => coupApi.setAutoPlay( gameId, { enabled } ),
		onSuccess: invalidate
	} );

	// Invalidates the finished game, not the new one. The server pushes the new
	// ref onto every connected view over the socket, so this is the fallback for
	// a client whose socket is down.
	const again = useMutation( {
		mutationFn: ( input: RematchInput ) => coupApi.rematch( gameId, input ),
		onSuccess: invalidate
	} );

	const playerId = data.view.playerId;
	const inProgress = data.status === "IN_PROGRESS";

	// A frame suspends the turn rather than spending it, so `currentPlayer` still
	// names the seat whose turn it is while the table answers a window. The turn
	// controls are hidden behind there being no window open at all.
	const [ frame ] = data.context.interactions.slice( -1 );

	const answerable = ANSWERABLE.find( kind => kind === frame?.kind );
	const awaiting = playerId
		&& frame
		&& answerable
		&& frame.responders.includes( playerId )
		&& !( playerId in frame.responses )
		? answerable
		: undefined;

	const isMyTurn = inProgress
		&& data.context.currentPlayer === playerId
		&& frame === undefined;

	const coins = playerId ? data.view.playerData[ playerId ]?.coins ?? 0 : 0;

	return (
		<CoupContext value={ {
			data,
			playerId,
			isMyTurn,
			awaiting,
			frame,
			actions: legalActions( coins ),
			opponents: playerId
				? livingOpponents( data.view, data.context.players, playerId )
				: [],
			takeAction: ( input, onDone ) => action.mutate( input, { onSuccess: onDone } ),
			challenge: input => doubt.mutate( input ),
			block: input => stop.mutate( input ),
			surrenderInfluence: input => surrender.mutate( input ),
			exchangeCards: input => exchange.mutate( input ),
			addBots: () => bots.mutate(),
			startGame: () => start.mutate(),
			setAutoPlay: enabled => autoPlay.mutate( enabled ),
			startRematch: ( input, onDone ) => again.mutate( input, { onSuccess: onDone } ),
			isPending: action.isPending
				|| doubt.isPending
				|| stop.isPending
				|| surrender.isPending
				|| exchange.isPending
				|| bots.isPending
				|| start.isPending
				|| autoPlay.isPending
				|| again.isPending
		} }>
			{ children }
		</CoupContext>
	);
}
