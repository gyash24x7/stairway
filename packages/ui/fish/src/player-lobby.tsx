import { cn } from "@s2h-ui/primitives/utils";
import { DisplayPlayer, type DisplayPlayerProps } from "@s2h-ui/shared/display-player";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";

export type PlayerLobbyProps = Omit<DisplayPlayerProps, "player" | "cardCount"> & {
	asTeams?: Record<string, string[]>;
	withTeamName?: boolean;
}

export function PlayerLobby( props: PlayerLobbyProps ) {
	const players = useStore( store, state => state.players );
	const playerIds = useStore( store, state => state.playerIds );
	const cardCounts = useStore( store, state => state.cardCounts );
	const playerCount = useStore( store, state => state.config.playerCount );

	if ( props.asTeams ) {
		return (
			<div className={ cn( "grid gap-2 grid-cols-2", playerCount % 3 === 0 && "grid-cols-3" ) }>
				{ Object.entries( props.asTeams ).map( ( [ team, members ] ) => (
					<div key={ team } className={ "flex flex-col gap-2" }>
						{ props.withTeamName && <h3 className={ "font-semibold" }>Team { team }</h3> }
						<div className={ "flex gap-2 flex-wrap" }>
							{ members.map( playerId => (
								<DisplayPlayer
									{ ...props }
									player={ players[ playerId ] }
									key={ playerId }
									cardCount={ cardCounts[ playerId ] }
								/>
							) ) }
						</div>
					</div>
				) ) }
			</div>
		);
	}

	return (
		<div
			className={ cn(
				"grid gap-2",
				playerCount === 3 && "grid-cols-3",
				playerCount === 4 && "grid-cols-2 lg:grid-cols-4",
				playerCount === 6 && "grid-cols-3 lg:grid-cols-6",
				playerCount === 8 && "grid-cols-4 lg:grid-cols-8"
			) }
		>
			{ playerIds.map( playerId => (
				<DisplayPlayer
					{ ...props }
					player={ players[ playerId ] }
					key={ playerId }
					cardCount={ cardCounts[ playerId ] }
				/>
			) ) }
		</div>
	);
}