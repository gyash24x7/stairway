"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { declareWins } from "@/callbreak/core/actions";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/primitives/dialog";
import { Spinner } from "@/shared/primitives/spinner";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useCounter } from "usehooks-ts";

export function DeclareWins() {
	const [ open, setOpen ] = useState( false );
	const { count: wins, increment, decrement, reset } = useCounter( 2 );
	const { game } = useCallbreak();
	const [ isPending, startTransition ] = useTransition();

	const handleClick = () => startTransition( async () => {
		await declareWins( {
			dealId: game.state.activeDeal?.id!,
			gameId: game.id,
			wins
		} );

		reset();
		setOpen( false );
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<Button className={ "w-full max-w-lg" } onClick={ () => setOpen( true ) }>
				DECLARE DEAL WINS
			</Button>
			<DialogContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DialogHeader>
						<DialogTitle>DECLARE DEAL WINS</DialogTitle>
						<DialogDescription/>
					</DialogHeader>
					<div className={ "flex flex-col gap-3 p-3" }>
						<div className="flex justify-center items-center space-x-2">
							<Button size="icon" onClick={ decrement } disabled={ wins <= 2 }>
								<MinusIcon className="h-4 w-4"/>
							</Button>
							<div className="w-20 h-10 flex items-center justify-center border bg-surface text-sm">
								{ wins }
							</div>
							<Button size="icon" onClick={ increment } disabled={ wins >= 13 }>
								<PlusIcon className="h-4 w-4"/>
							</Button>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={ handleClick } disabled={ isPending } className={ "max-w-lg" }>
							{ isPending ? <Spinner/> : "DECLARE WINS" }
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}