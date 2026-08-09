"use client";

import { ChatPanel } from "@/chat/client/chat-panel.tsx";
import { GameInfo } from "@/shared/ui/components/game-info.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { Board } from "@/games/wordle/client/board.tsx";
import { useWordle } from "@/games/wordle/client/context.tsx";
import { Keyboard } from "@/games/wordle/client/keyboard.tsx";

export function GameView() {
	const { data } = useWordle();
	const gameInProgress = data.status === "IN_PROGRESS";
	const gameCompleted = data.status === "COMPLETED";

	return (
		<div className={ cn( "flex flex-col gap-3 items-center mb-40 max-w-6xl w-full" ) }>
			<GameInfo
				code={ data.code }
				name={ "Wordle" }
				completed={ gameCompleted }
				actions={ <ChatPanel channelId={ data.id }/> }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>GUESSES</p>
						<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
							{ data.view.guesses.length + "/" + data.view.maxGuesses }
						</h2>
					</div>
				}
			/>
			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ data.view._tag === "wordle/PlayerView" ? data.view.playerId : undefined }
				scoreLabel={ "GUESSES" }
			/>
			<Board/>
			{ gameInProgress && (
				<div
					className={ cn(
						"fixed bottom-0 bg-surface left-0 right-0",
						"rounded-t-xl flex gap-3 p-3 justify-center"
					) }
				>
					<Keyboard/>
				</div>
			) }
		</div>
	);
}
