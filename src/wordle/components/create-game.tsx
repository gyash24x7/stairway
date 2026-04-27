"use client";

import { CreateGame } from "@/shared/components/create-game";
import { Button } from "@/shared/primitives/button";
import { cn } from "@/shared/utils/cn";
import { createGame } from "@/wordle/core/actions";
import type { WordLength } from "@/wordle/core/types";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

export function WordleCreateGame() {
	const [ wordLength, setWordLength ] = useState<WordLength>( 5 );
	const [ wordCount, setWordCount ] = useState( 1 );

	const increment = () => setWordCount( wordCount + 1 );
	const decrement = () => setWordCount( wordCount - 1 );

	const createWordleGame = async () => {
		return createGame( { wordLength, wordCount } );
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
							"w-20 h-10 flex items-center justify-center",
							"border bg-surface text-sm border-inverted-surface"
						) }
					>
						{ wordCount }
					</div>
					<Button size="icon" onClick={ increment } disabled={ wordCount >= 8 }>
						<PlusIcon className="h-4 w-4"/>
					</Button>
				</div>
				<h2>Select Word Length</h2>
				<div className={ "flex gap-2" }>
					{ ( [ 4, 5, 6 ] as const ).map( len => (
						<div
							key={ len }
							onClick={ () => setWordLength( len ) }
							className={ cn(
								len === wordLength ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2",
								"flex justify-center hover:bg-background border-inverted-surface"
							) }
						>
							{ len }
						</div>
					) ) }
				</div>
			</div>
		</CreateGame>
	);
}
