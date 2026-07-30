"use client";

import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/shared/ui/utils/cn.ts";
import { useFish } from "@/games/fish/client/context.tsx";

export function TurnIndicator() {
	const { data } = useFish();
	const player = data.view;

	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === player.playerId;
	const currentPlayerName = data.players[ data.context.currentPlayer ].name.toUpperCase();

	const lastClaim = data.view.claimHistory[ 0 ];
	const canTransfer = data.view.lastMoveType === "claim"
		&& lastClaim?.success
		&& lastClaim.playerId === player.playerId;

	const hasCards = player.hand.length > 0;

	let hint = "";
	if ( isMyTurn ) {
		if ( canTransfer ) {
			hint = "You can transfer your turn or claim another book";
		} else if ( hasCards ) {
			hint = "Ask an opponent for a card or claim a book";
		} else {
			hint = "You have no cards — claim a book for your team";
		}
	}

	const heading = isMyTurn ? "YOUR TURN!" : `${ currentPlayerName }'S TURN`;

	return (
		<motion.div
			layout
			className={ cn(
				"p-2 md:p-3 rounded-md w-full text-center",
				isMyTurn ? "bg-accent text-neutral-dark" : "bg-background"
			) }
			animate={ isMyTurn
				? {
					boxShadow: [
						"0 0 0 0 rgba(0,0,0,0)",
						"0 0 0 6px var(--color-accent)",
						"0 0 0 0 rgba(0,0,0,0)"
					]
				}
				: { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
			}
		>
			<AnimatePresence mode={ "wait" }>
				<motion.p
					key={ heading }
					className={ "text-sm md:text-lg xl:text-xl font-semibold" }
					initial={ { opacity: 0, scale: 0.7 } }
					animate={ { opacity: 1, scale: 1 } }
					exit={ { opacity: 0, scale: 0.7 } }
					transition={ { type: "spring", stiffness: 380, damping: 22 } }
				>
					{ heading }
				</motion.p>
			</AnimatePresence>
			{ isMyTurn && hint && (
				<motion.p
					className={ "text-xs md:text-sm mt-1 opacity-80" }
					key={ hint }
					initial={ { opacity: 0 } }
					animate={ { opacity: 0.8 } }
					exit={ { opacity: 0 } }
					transition={ { duration: 0.25 } }
				>
					{ hint }
				</motion.p>
			) }
		</motion.div>
	);
}
