"use client";

import { declareDealWins } from "@/callbreak/server/functions";
import { store } from "@/callbreak/store";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { useStore } from "@tanstack/react-store";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useCounter } from "usehooks-ts";


export function DeclareDealWins() {
	const [ isPending, startTransition ] = useTransition();
	const [ open, setOpen ] = useState( false );
	const { count: wins, increment, decrement, reset } = useCounter( 2 );

	const gameId = useStore( store, state => state.game.id );
	const dealId = useStore( store, state => state.currentDeal!.id );
	const playerId = useStore( store, state => state.playerId );

	const handleClick = () => startTransition( async () => {
		const { error } = await declareDealWins( { gameId, dealId, wins, playerId } );
		if ( !error ) {
			reset();
			setOpen( false );
		} else {
			alert( error );
		}
	} );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button className={ "w-full max-w-lg" }>DECLARE DEAL WINS</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle>DECLARE DEAL WINS</DrawerTitle>
					</DrawerHeader>
					<div className={ "flex flex-col gap-3" }>
						<div className="flex justify-center items-center space-x-2">
							<Button size="icon" onClick={ decrement } disabled={ wins <= 2 }>
								<MinusIcon className="h-4 w-4"/>
							</Button>
							<div className="w-20 h-10 flex items-center justify-center border bg-bg text-sm">
								{ wins }
							</div>
							<Button size="icon" onClick={ increment } disabled={ wins >= 13 }>
								<PlusIcon className="h-4 w-4"/>
							</Button>
						</div>
					</div>
					<DrawerFooter>
						<Button onClick={ handleClick } disabled={ isPending } className={ "max-w-lg" }>
							{ isPending ? <Spinner/> : "DECLARE WINS" }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}