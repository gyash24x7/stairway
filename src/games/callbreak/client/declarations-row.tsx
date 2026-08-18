"use client";

import { AnimatePresence } from "framer-motion";

import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DeclarationBadge } from "@/games/callbreak/client/declaration-badge.tsx";
import { RPlayerInfoStrip } from "@/swish/client/player-info.tsx";

/**
 * Every seat's declaration, for the controller — the phone's equivalent of the
 * badges the couch screen shows on its 2x2 table. Without this a player watching
 * their own phone would see nothing happen for the whole declaring phase.
 */
export function DeclarationsRow() {
	const { data } = useCallbreak();
	const declarations = data.view.activeDeal?.declarations;

	return (
		<div className={ "flex flex-col gap-2 bg-background rounded-md p-3 w-full" }>
			<p className={ "text-xs tracking-widest text-muted-foreground text-center" }>DECLARATIONS</p>
			<div className={ "flex gap-2 justify-between" }>
				{ data.context.players.map( playerId => (
					<div key={ playerId } className={ "flex flex-col gap-1 items-center" }>
						<AnimatePresence mode={ "wait" }>
							<DeclarationBadge
								key={ !declarations?.[ playerId ]
									? `awaiting-${ playerId }`
									: `declared-${ playerId }` }
								wins={ declarations?.[ playerId ] || undefined }
								pending={ data.context.currentPlayer === playerId }
							/>
						</AnimatePresence>
						<RPlayerInfoStrip player={ data.players[ playerId ] } noAvatar/>
					</div>
				) ) }
			</div>
		</div>
	);
}
