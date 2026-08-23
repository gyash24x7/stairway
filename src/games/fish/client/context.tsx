"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import type { ReactNode } from "react";

import { fishApi } from "@/games/fish/client/client.ts";
import { FishConfig, FishSeatView } from "@/games/fish/shared/schema.ts";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { GameView } from "@/swish/shared/schema.ts";

import type {
	AskCardInput,
	ClaimBookInput,
	FishView,
	TransferTurnInput
} from "@/games/fish/shared/schema.ts";
import type {
	GameId,
	GameRef,
	RematchInput,
	TeamId,
	TeamName
} from "@/swish/shared/schema.ts";

type FishContextValue = {
	data: GameView<FishSeatView, FishConfig>;
	isMyTurn: boolean;
	startRematch: ( input: RematchInput, onDone: ( ref: GameRef ) => void ) => void;
	isPending: boolean;
	askCard: ( input: AskCardInput ) => void;
	claimBook: ( input: ClaimBookInput, onDone?: () => void ) => void;
	transferTurn: ( input: TransferTurnInput, onDone?: () => void ) => void;
	joinTeam: ( team: TeamId ) => void;
	nameTeam: ( team: TeamId, name: TeamName ) => void;
	leaveTeam: () => void;
	addBots: () => void;
	startGame: () => void;
	setAutoPlay: ( enabled: boolean ) => void;
};

const FishContext = createContext<FishContextValue | null>( null );

export function useFish() {
	const ctx = useContext( FishContext );
	if ( !ctx ) {
		throw new Error( "useFish must be used within a FishProvider" );
	}
	return ctx;
}

type FishProviderProps = {
	data: GameView<FishView, FishConfig>;
	gameId: GameId;
	children: ReactNode;
};

export function FishProvider( { data, gameId, children }: FishProviderProps ) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "fish", "getState", gameId ]
	} );

	const ask = useMutation( {
		mutationFn: ( input: AskCardInput ) => fishApi.askCard( gameId, input ),
		onSuccess: invalidate
	} );

	const claim = useMutation( {
		mutationFn: ( input: ClaimBookInput ) => fishApi.claimBook( gameId, input ),
		onSuccess: invalidate
	} );

	const transfer = useMutation( {
		mutationFn: ( input: TransferTurnInput ) => fishApi.transferTurn( gameId, input ),
		onSuccess: invalidate
	} );

	const team = useMutation( {
		mutationFn: ( input: TeamId ) => fishApi.joinTeam( gameId, { team: input } ),
		onSuccess: invalidate
	} );

	const leave = useMutation( {
		mutationFn: () => fishApi.leaveTeam( gameId ),
		onSuccess: invalidate
	} );

	const name = useMutation( {
		mutationFn: ( input: { team: TeamId; name: TeamName } ) => fishApi.nameTeam( gameId, input ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => fishApi.addBots( gameId ),
		onSuccess: invalidate
	} );

	const start = useMutation( {
		mutationFn: () => fishApi.start( gameId ),
		onSuccess: invalidate
	} );

	const autoPlay = useMutation( {
		mutationFn: ( enabled: boolean ) => fishApi.setAutoPlay( gameId, { enabled } ),
		onSuccess: invalidate
	} );

	// Invalidates the finished game, not the new one. The server pushes the new
	// ref onto every connected view over the socket, so this is the fallback for
	// a client whose socket is down: its own screen becomes the join state.
	const again = useMutation( {
		mutationFn: ( input: RematchInput ) => fishApi.rematch( gameId, input ),
		onSuccess: invalidate
	} );

	// A caller holding no seat gets the table view, whose hand is empty — there is
	// nothing here for them to play, so the spectator case is simply not rendered.
	if ( !data.view.playerId ) {
		// A screen holding no seat — a spectator, or a stale link. These three games
		// have only a seat's screen to offer, so say so rather than rendering blank.
		return (
			<ErrorState
				title={ "You don't have a seat in this game" }
				message={ "This game is already under way, and only its players can watch it." }
				action={ { label: "BACK TO LOBBY", to: "/fish" } }
			/>
		);
	}

	const playerData = GameView( FishSeatView, FishConfig )
		.make( { ...data, view: { ...data.view, playerId: data.view.playerId } } );

	const isMyTurn = playerData.status === "IN_PROGRESS"
		&& playerData.context.currentPlayer === playerData.view.playerId;

	return (
		<FishContext value={ {
			data: playerData,
			isMyTurn,
			startRematch: ( input, onDone ) => again.mutate( input, { onSuccess: onDone } ),
			isPending: ask.isPending
				|| claim.isPending
				|| transfer.isPending
				|| team.isPending
				|| name.isPending
				|| leave.isPending
				|| bots.isPending
				|| start.isPending
				|| autoPlay.isPending || again.isPending,
			askCard: input => ask.mutate( input ),
			claimBook: ( input, onDone ) => claim.mutate( input, { onSuccess: onDone } ),
			transferTurn: ( input, onDone ) => transfer.mutate( input, { onSuccess: onDone } ),
			joinTeam: id => team.mutate( id ),
			nameTeam: ( id, teamName ) => name.mutate( { team: id, name: teamName } ),
			leaveTeam: () => leave.mutate(),
			addBots: () => bots.mutate(),
			startGame: () => start.mutate(),
			setAutoPlay: enabled => autoPlay.mutate( enabled )
		} }>
			{ children }
		</FishContext>
	);
}
