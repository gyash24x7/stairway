"use client";

import type { FishGame } from "@/fish/core/types";
import { createContext, type ReactNode, useContext } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type FishContextValue = {
	shared: FishGame["shared"];
	player: FishGame["player"];
};

const FishContext = createContext<FishContextValue | null>( null );

export function useFish() {
	const ctx = useContext( FishContext );
	if ( !ctx ) {
		throw new Error( "useFish must be used within a FishProvider" );
	}
	return ctx;
}

type FishProviderProps = { data: FishGame; children: ReactNode; };

export function FishProvider( { data, children }: FishProviderProps ) {
	const room = `fish:${ data.shared.id }`;
	const [ shared ] = useSyncedState( data.shared, "shared", room );
	const [ player ] = useSyncedState( data.player, data.player.playerId, room );
	return (
		<FishContext value={ { shared, player } }>
			{ children }
		</FishContext>
	);
}
