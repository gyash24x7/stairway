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
import { Separator } from "@s2h-ui/primitives/separator";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useCreateGameMutation } from "@s2h/client/wordle";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function CreateGame() {
	const [ open, setOpen ] = useState( false );
	const [ wordCount, setWordCount ] = useState( 2 );
	const navigate = useNavigate();
	const { mutateAsync, isPending } = useCreateGameMutation( {
		onSuccess: ( data ) => navigate( { to: `/wordle/${ data.id }` } ),
		onSettled: () => setOpen( false )
	} );

	const increment = () => setWordCount( wordCount + 1 );
	const decrement = () => setWordCount( wordCount - 1 );
	const handleClick = () => mutateAsync( { wordCount } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger className={ buttonVariants() }>CREATE GAME</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>Create Game</DialogTitle>
					<DialogDescription/>
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
