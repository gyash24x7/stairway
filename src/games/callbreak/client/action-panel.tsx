"use client";

import { cn } from "@/shared/ui/utils/cn.ts";
import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DeclareWins } from "@/games/callbreak/client/declare-wins.tsx";
import { PlayCard } from "@/games/callbreak/client/play-card.tsx";

export function ActionPanel() {
	const { isMyTurn, data } = useCallbreak();
	const phase = data.context.phase;

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-surface z-10",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ phase === "DECLARING" && isMyTurn && <DeclareWins/> }
				{ phase === "PLAYING" && isMyTurn && <PlayCard/> }
			</div>
		</div>
	);
}
