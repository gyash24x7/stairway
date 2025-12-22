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
import { useCreateGameMutation } from "@s2h/client/fish";
import type { BookType, PlayerCount, TeamCount } from "@s2h/fish/types";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function CreateGame() {
	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();
	const [ teamCount, setTeamCount ] = useState<TeamCount>();
	const [ type, setType ] = useState<BookType>();
	const [ open, setOpen ] = useState( false );
	const navigate = useNavigate();

	const { mutateAsync, isPending } = useCreateGameMutation( {
		onSuccess: ( { gameId } ) => navigate( { to: `/fish/${ gameId }` } )
	} );

	const handleClick = () => mutateAsync( { playerCount: playerCount!, teamCount: teamCount!, type: type! } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger className={ buttonVariants() }>CREATE GAME</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle className={ "font-bold" }>CREATE GAME</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<h2>SELECT PLAYER COUNT</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ ( [ 3, 4, 6, 8 ] as const ).map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setPlayerCount( playerCount === item ? undefined : item ) }
								className={ cn(
									playerCount === item ? "bg-secondary-background" : "bg-bg",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
									"hover:bg-secondary-background"
								) }
							>
								{ item }
							</div>
						) ) }
					</div>
					<h2>SELECT TEAM COUNT</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ ( [ 2, 3, 4 ] as const ).map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setTeamCount( teamCount === item ? undefined : item ) }
								className={ cn(
									teamCount === item ? "bg-secondary-background" : "bg-bg",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
									"hover:bg-secondary-background"
								) }
							>
								{ item }
							</div>
						) ) }
					</div>
					<h2>SELECT GAME TYPE</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ ( [ "CANADIAN", "NORMAL" ] as const ).map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setType( type === item ? undefined : item ) }
								className={ cn(
									type === item ? "bg-secondary-background" : "bg-bg",
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