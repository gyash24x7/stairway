"use client";

import { orpc } from "@/app/client/orpc";
import { store } from "@/app/components/callbreak/store";
import { Button } from "@/app/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/app/primitives/drawer";
import { Spinner } from "@/app/primitives/spinner";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useCounter } from "usehooks-ts";

export function DeclareDealWins() {
	const [ open, setOpen ] = useState( false );
	const { count: wins, increment, decrement, reset } = useCounter( 2 );
	const gameId = useStore( store, state => state.id );
	const dealId = useStore( store, state => state.currentDeal!.id );

	const { mutateAsync, isPending } = useMutation( orpc.callbreak.declareDealWins.mutationOptions( {
		onSuccess: () => {
			reset();
			setOpen( false );
		},
		onError: ( err ) => alert( err.message )
	} ) );

	const handleClick = () => mutateAsync( { gameId, dealId, wins } );

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