import { Button, buttonVariants } from "@s2h-ui/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@s2h-ui/primitives/dialog";
import { MinusIcon, PlusIcon } from "@s2h-ui/primitives/icons";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { useDeclareDealWinsMutation } from "@s2h/client/callbreak";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { useCounter } from "usehooks-ts";
import { store } from "./store.tsx";

export function DeclareDealWins() {
	const [ open, setOpen ] = useState( false );
	const { count: wins, increment, decrement, reset } = useCounter( 2 );
	const gameId = useStore( store, state => state.id );
	const dealId = useStore( store, state => state.currentDeal!.id );

	const { mutateAsync, isPending } = useDeclareDealWinsMutation( {
		onSuccess: () => {
			reset();
			setOpen( false );
		},
		onError: ( err ) => alert( err.message )
	} );

	const handleClick = () => mutateAsync( { gameId, dealId, wins } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger className={ cn( buttonVariants(), "w-full max-w-lg" ) }>
				DECLARE DEAL WINS
			</DialogTrigger>
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