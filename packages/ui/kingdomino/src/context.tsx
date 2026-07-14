"use client";

import type {
	GameContext,
	GameStatus,
	GameId,
	GameCode,
	PlayerId,
	PlayerInfo,
	Players
} from "@s2h/swish/schema";
import type {
	KingdominoConfig,
	KingdominoData,
	KingdominoSharedView,
	PlayerData
} from "@s2h/kingdomino/schema";
import { createContext, type ReactNode, useContext } from "react";

/** A player's roster info merged with their per-player Kingdomino game data. */
export type KingdominoPlayerInfo = PlayerInfo & PlayerData;

/**
 * The view the Kingdomino components read. The wire `KingdominoData` splits the
 * game into top-level lifecycle fields + a `shared` view + a `player` view; the
 * components predate that split and read a single flattened game object, so this
 * context reassembles one: `shared` carries the lifecycle fields alongside the
 * shared view (under `state`), and `player` exposes the caller's `playerId`.
 */
export type KingdominoShared = {
	id: GameId;
	code: GameCode;
	status: GameStatus;
	context: GameContext;
	players: Players;
	config: KingdominoConfig;
	state: KingdominoSharedView;
};

type KingdominoContextValue = {
	shared: KingdominoShared;
	player: { playerId: PlayerId };
};

const KingdominoContext = createContext<KingdominoContextValue | null>( null );

export function useKingdomino() {
	const ctx = useContext( KingdominoContext );
	if ( !ctx ) {
		throw new Error( "useKingdomino must be used within a KingdominoProvider" );
	}
	return ctx;
}

type KingdominoProviderProps = { data: KingdominoData; children: ReactNode; };

export function KingdominoProvider( { data, children }: KingdominoProviderProps ) {
	const shared: KingdominoShared = {
		id: data.id,
		code: data.code,
		status: data.status,
		context: data.context,
		players: data.players,
		config: data.config,
		state: data.shared
	};
	const player = { playerId: data.player.playerId };
	return (
		<KingdominoContext value={ { shared, player } }>
			{ children }
		</KingdominoContext>
	);
}
