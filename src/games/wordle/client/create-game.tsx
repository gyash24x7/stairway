import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import type { WordLength } from "@/games/wordle/shared/schema.ts";
import { CreateGame } from "@/shared/ui/components/create-game.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { createWordleGameFn } from "@/games/wordle/client/client.ts";

export function WordleCreateGame() {
	const [ wordLength, setWordLength ] = useState<WordLength>( 5 );
	const [ wordCount, setWordCount ] = useState( 1 );

	const increment = () => setWordCount( wordCount + 1 );
	const decrement = () => setWordCount( wordCount - 1 );

	// Wordle is effectively single-player: one seat, auto-started on create.
	const createWordleGame = async () => {
		const { id } = await createWordleGameFn( {
			playerCount: 1,
			autoStart: true,
			wordCount,
			wordLength
		} );
		return id;
	};

	return (
		<CreateGame
			game={ "wordle" }
			disabled={ !wordLength || !wordCount }
			createGame={ createWordleGame }
		>
			<div className={ "flex flex-col gap-3" }>
				<h2>Select Number of Words</h2>
				<div className="flex justify-center items-center space-x-2">
					<Button size="icon" onClick={ decrement } disabled={ wordCount <= 2 }>
						<MinusIcon className="h-4 w-4"/>
					</Button>
					<div
						className={ cn(
							"flex-1 h-8 md:h-10 flex items-center justify-center",
							"border bg-surface text-sm border-inverted-surface rounded-md"
						) }
					>
						{ wordCount }
					</div>
					<Button size="icon" onClick={ increment } disabled={ wordCount >= 8 }>
						<PlusIcon className="h-4 w-4"/>
					</Button>
				</div>
				<h2>Select Word Length</h2>
				<RadioSelect
					options={ [ 4, 5, 6 ] as const }
					value={ wordLength }
					onChange={ v => v !== undefined && setWordLength( v ) }
					allowDeselect={ false }
				/>
			</div>
		</CreateGame>
	);
}
