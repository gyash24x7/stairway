"use client";

import type { FishSharedView, FishSnapshot } from "@s2h/fish/schema";
import type { GameContext, GameStatus, Players } from "@s2h/swish/schema";
import { createContext, type ReactNode, useContext } from "react";

/** The `shared` shape the components read: game metadata + the shared view. */
type FishShared = {
	id: string;
	code: string;
	config: FishSnapshot[ "config" ];
	state: FishSharedView;
	players: Players;
	status: GameStatus;
	context: GameContext;
};

type FishContextValue = {
	shared: FishShared;
	player: FishSnapshot[ "player" ];
};

const FishContext = createContext<FishContextValue | null>( null );

export function useFish() {
	const ctx = useContext( FishContext );
	if ( !ctx ) {
		throw new Error( "useFish must be used within a FishProvider" );
	}
	return ctx;
}

type FishProviderProps = { data: FishSnapshot; children: ReactNode; };

/**
 * Reshape the lifecycle-generic `FishSnapshot` (config/shared/player split apart
 * from the game metadata) into the `{ shared, player }` value the Fish
 * components read, where `shared` folds the metadata and the shared view
 * (`shared.state`) back together the way the old oRPC `FishGame` did.
 */
export function FishProvider( { data, children }: FishProviderProps ) {
	const shared: FishShared = {
		id: data.id,
		code: data.code,
		config: data.config,
		state: data.shared,
		players: data.players,
		status: data.status,
		context: data.context
	};

	return (
		<FishContext value={ { shared, player: data.player } }>
			{ children }
		</FishContext>
	);
}
