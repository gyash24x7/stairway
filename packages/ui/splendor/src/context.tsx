import type { SplendorSnapshot } from "@s2h/splendor/schema";
import type { PlayerId } from "@s2h/swish/schema";
import { createContext, type ReactNode, useContext } from "react";

// The wire snapshot is flat (`{ id, code, status, context, players, config,
// shared, player }`). The components below were written against the legacy
// "shared game data" shape, where the game-specific view lived under a nested
// `state` key and the lifecycle fields sat alongside it. We reshape the snapshot
// once here so every consumer keeps reading `shared.state.*`, `shared.config`,
// `shared.id`, etc. unchanged.
type SharedGameData = Pick<
	SplendorSnapshot,
	"id" | "code" | "status" | "context" | "players" | "config"
> & { state: SplendorSnapshot["view"] };

type SplendorContextValue = {
	shared: SharedGameData;
	player: { playerId: PlayerId };
	gameId: string;
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
	snapshot: SplendorSnapshot;
	gameId: string;
	children: ReactNode;
};

export function SplendorProvider( { snapshot, gameId, children }: SplendorProviderProps ) {
	const shared: SharedGameData = {
		id: snapshot.id,
		code: snapshot.code,
		status: snapshot.status,
		context: snapshot.context,
		players: snapshot.players,
		config: snapshot.config,
		state: snapshot.view
	};
	return (
		<SplendorContext value={ { shared, player: { playerId: snapshot.view.playerId! }, gameId } }>
			{ children }
		</SplendorContext>
	);
}
