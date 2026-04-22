"use client";

import type { KingdominoGame } from "@/kingdomino/core/types";
import { createContext, type ReactNode, useContext } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type KingdominoContextValue = {
	shared: KingdominoGame["shared"];
	player: KingdominoGame["player"];
};

const KingdominoContext = createContext<KingdominoContextValue | null>( null );

export function useKingdomino() {
	const ctx = useContext( KingdominoContext );
	if ( !ctx ) {
		throw new Error( "useKingdomino must be used within a KingdominoProvider" );
	}
	return ctx;
}

type KingdominoProviderProps = { data: KingdominoGame; children: ReactNode; };

export function KingdominoProvider( { data, children }: KingdominoProviderProps ) {
	const room = `kingdomino:${ data.shared.id }`;
	const [ shared ] = useSyncedState( data.shared, "shared", room );
	const [ player ] = useSyncedState( data.player, data.player.playerId, room );
	return (
		<KingdominoContext value={ { shared, player } }>
			{ children }
		</KingdominoContext>
	);
}
