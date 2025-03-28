"use client";

import { Button } from "@/components/base/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/base/dialog";
import { Separator } from "@/components/base/separator";
import { Spinner } from "@/components/base/spinner";
import { createGame } from "@/server/wordle/functions";
import { MinusIcon, PlusIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { useState, useTransition } from "react";

export function CreateGame() {
	const [ open, setOpen ] = useState( false );
	const [ wordCount, setWordCount ] = useState( 2 );
	const [ isPending, startTransition ] = useTransition();

	const increment = () => setWordCount( wordCount + 1 );

	const decrement = () => setWordCount( wordCount - 1 );

	const handleClick = () => startTransition( async () => {
		const game = await createGame( { wordCount } );
		redirect( `/wordle/${ game.id }` );
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button>CREATE GAME</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>Create Game</DialogTitle>
				</DialogHeader>
				<Separator/>
				<div className={ "flex flex-col gap-3" }>
					<h2>Select Number of Words</h2>
					<div className="flex justify-center items-center space-x-2">
						<Button size="icon" onClick={ decrement } disabled={ wordCount <= 2 }>
							<MinusIcon className="h-4 w-4"/>
						</Button>
						<div className="w-20 h-10 flex items-center justify-center border bg-bg text-sm">
							{ wordCount }
						</div>
						<Button size="icon" onClick={ increment } disabled={ wordCount >= 8 }>
							<PlusIcon className="h-4 w-4"/>
						</Button>
					</div>
				</div>
				<Separator/>
				<DialogFooter>
					<Button onClick={ handleClick } disabled={ isPending }>
						{ isPending ? <Spinner/> : "CREATE GAME" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
