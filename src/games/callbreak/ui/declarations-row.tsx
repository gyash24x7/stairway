import { AnimatePresence } from "framer-motion";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { DeclarationBadge } from "@/games/callbreak/ui/declaration-badge";
import type { GameView } from "@/swish/schema";
import { RPlayerInfoStrip } from "@/swish/ui/player-info";

type Game = GameView<CallbreakView, CallbreakConfig>;

/**
 * Every seat's declaration, for the controller — the phone's equivalent of the
 * badges the couch screen shows on its 2x2 table. Without this a player watching
 * their own phone would see nothing happen for the whole declaring phase.
 */
export function DeclarationsRow( { game }: { game: Game } ) {
	const declarations = game.view.activeDeal?.declarations;
	const seats = game.context.players.flatMap( playerId => {
		const player = game.players[ playerId ];
		return player ? [ player ] : [];
	} );

	return (
		<div className={ "flex flex-col gap-2 bg-background rounded-md p-3 w-full" }>
			<p className={ "text-xs tracking-widest text-muted-foreground text-center" }>DECLARATIONS</p>
			<div className={ "flex gap-2 justify-between" }>
				{ seats.map( player => (
					<div key={ player.id } className={ "flex flex-col gap-1 items-center" }>
						<AnimatePresence mode={ "wait" }>
							<DeclarationBadge
								key={ !declarations?.[ player.id ]
									? `awaiting-${ player.id }`
									: `declared-${ player.id }` }
								wins={ declarations?.[ player.id ] || undefined }
								pending={ game.context.currentPlayer === player.id }
							/>
						</AnimatePresence>
						<RPlayerInfoStrip player={ player } noAvatar/>
					</div>
				) ) }
			</div>
		</div>
	);
}
