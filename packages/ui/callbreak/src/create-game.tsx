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
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCardSuit } from "@s2h-ui/shared/display-card";
import { useCreateGameMutation } from "@s2h/client/callbreak";
import { CARD_SUITS, type CardSuit } from "@s2h/utils/cards";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function CreateGame() {
	const [ selectedSuit, setSelectedSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<5 | 9 | 13>();
	const [ open, setOpen ] = useState( false );
	const navigate = useNavigate();

	const { mutateAsync, isPending } = useCreateGameMutation( {
		onSuccess: ( { gameId } ) => navigate( { to: `/callbreak/${ gameId }` } ),
		onError: ( err ) => alert( err.message ),
		onSettled: () => setOpen( false )
	} );

	const handleClick = () => mutateAsync( { trumpSuit: selectedSuit!, dealCount } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger className={ buttonVariants() }>CREATE GAME</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>Create Game</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<h2>Select Trump Suit</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ Object.values( CARD_SUITS ).map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setSelectedSuit( selectedSuit === item ? undefined : item ) }
								className={ cn(
									selectedSuit === item ? "bg-secondary-background" : "bg-bg",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
									"hover:bg-secondary-background"
								) }
							>
								<DisplayCardSuit suit={ item }/>
							</div>
						) ) }
					</div>
					<h2>Select Number of Deals</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ [ 5 as const, 9 as const, 13 as const ].map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setDealCount( dealCount === item ? undefined : item ) }
								className={ cn(
									dealCount === item ? "bg-secondary-background" : "bg-bg",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
									"hover:bg-secondary-background"
								) }
							>
								{ item }
							</div>
						) ) }
					</div>
				</div>
				<DialogFooter>
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "CREATE GAME" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}