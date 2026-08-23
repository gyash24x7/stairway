"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import type { ReactNode } from "react";

import { splendorApi } from "@/games/splendor/client/client.ts";
import { SPLENDOR_NOBLE_VISIT } from "@/games/splendor/shared/schema.ts";
import { hasLegalMove } from "@/games/splendor/shared/utils.ts";

import type {
	ClaimNobleInput,
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorView
} from "@/games/splendor/shared/schema.ts";
import type { GameId, GameRef, GameView, PlayerId, RematchInput } from "@/swish/shared/schema.ts";

/**
 * One context for all three screens.
 *
 * The wire carries exactly one envelope, and Splendor's only hidden state is the
 * order of the three decks — so a seat's view and a spectator's differ in
 * `view.playerId` alone. `playerId` is therefore optional here and everything
 * seat-shaped derives from it; the television gets `isMyTurn: false` and simply
 * never renders a control.
 */
type SplendorContextValue = {
	data: GameView<SplendorView, SplendorConfig>;
	/** The viewing seat, absent on a shared screen. */
	playerId?: PlayerId;
	isMyTurn: boolean;
	/** Whether the rules leave this seat nothing to do but give up its turn. */
	mustPass: boolean;
	/** The noble frame waiting on this seat, if one is open. */
	awaitingNoble: boolean;
	pickTokens: ( input: PickTokensInput, onDone?: () => void ) => void;
	reserveCard: ( input: ReserveCardInput, onDone?: () => void ) => void;
	purchaseCard: ( input: PurchaseCardInput, onDone?: () => void ) => void;
	claimNoble: ( input: ClaimNobleInput ) => void;
	pass: () => void;
	addBots: () => void;
	startGame: () => void;
	setAutoPlay: ( enabled: boolean ) => void;
	startRematch: ( input: RematchInput, onDone: ( ref: GameRef ) => void ) => void;
	isPending: boolean;
};

const SplendorContext = createContext<SplendorContextValue | null>( null );

export function useSplendor() {
	const ctx = useContext( SplendorContext );
	if ( !ctx ) {
		throw new Error( "useSplendor must be used within a SplendorProvider" );
	}
	return ctx;
}

type SplendorProviderProps = {
	data: GameView<SplendorView, SplendorConfig>;
	gameId: GameId;
	children: ReactNode;
};

export function SplendorProvider( { data, gameId, children }: SplendorProviderProps ) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "splendor", "getState", gameId ]
	} );

	const tokens = useMutation( {
		mutationFn: ( input: PickTokensInput ) => splendorApi.pickTokens( gameId, input ),
		onSuccess: invalidate
	} );

	const reserve = useMutation( {
		mutationFn: ( input: ReserveCardInput ) => splendorApi.reserveCard( gameId, input ),
		onSuccess: invalidate
	} );

	const purchase = useMutation( {
		mutationFn: ( input: PurchaseCardInput ) => splendorApi.purchaseCard( gameId, input ),
		onSuccess: invalidate
	} );

	const noble = useMutation( {
		mutationFn: ( input: ClaimNobleInput ) => splendorApi.claimNoble( gameId, input ),
		onSuccess: invalidate
	} );

	const giveUp = useMutation( {
		mutationFn: () => splendorApi.pass( gameId ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => splendorApi.addBots( gameId ),
		onSuccess: invalidate
	} );

	const start = useMutation( {
		mutationFn: () => splendorApi.start( gameId ),
		onSuccess: invalidate
	} );

	const autoPlay = useMutation( {
		mutationFn: ( enabled: boolean ) => splendorApi.setAutoPlay( gameId, { enabled } ),
		onSuccess: invalidate
	} );

	// Invalidates the finished game, not the new one. The server pushes the new
	// ref onto every connected view over the socket, so this is the fallback for
	// a client whose socket is down: its own screen becomes the join state.
	const again = useMutation( {
		mutationFn: ( input: RematchInput ) => splendorApi.rematch( gameId, input ),
		onSuccess: invalidate
	} );

	const playerId = data.view.playerId;
	const isMyTurn = data.status === "IN_PROGRESS" && data.context.currentPlayer === playerId;

	const me = playerId ? data.view.playerData[ playerId ] : undefined;

	// `hasLegalMove` is what the engine's `pass` validates against, run here so the
	// button appears exactly when the command would be accepted.
	const mustPass = isMyTurn && !!me && !hasLegalMove( data.view, me );

	// A frame routes every move played while it is open, so the noble choice takes
	// priority over the ordinary turn controls.
	const [ frame ] = data.context.interactions.slice( -1 );
	const awaitingNoble = !!playerId
		&& frame?.kind === SPLENDOR_NOBLE_VISIT
		&& frame.initiator === playerId;

	return (
		<SplendorContext value={ {
			data,
			playerId,
			isMyTurn,
			mustPass,
			awaitingNoble,
			pickTokens: ( input, onDone ) => tokens.mutate( input, { onSuccess: onDone } ),
			reserveCard: ( input, onDone ) => reserve.mutate( input, { onSuccess: onDone } ),
			purchaseCard: ( input, onDone ) => purchase.mutate( input, { onSuccess: onDone } ),
			claimNoble: input => noble.mutate( input ),
			pass: () => giveUp.mutate(),
			addBots: () => bots.mutate(),
			startGame: () => start.mutate(),
			setAutoPlay: enabled => autoPlay.mutate( enabled ),
			startRematch: ( input, onDone ) => again.mutate( input, { onSuccess: onDone } ),
			isPending: tokens.isPending
				|| reserve.isPending
				|| purchase.isPending
				|| noble.isPending
				|| giveUp.isPending
				|| bots.isPending
				|| start.isPending
				|| autoPlay.isPending
				|| again.isPending
		} }>
			{ children }
		</SplendorContext>
	);
}
