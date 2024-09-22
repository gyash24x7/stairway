import {
	Alert,
	AlertTitle,
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Spinner
} from "@base/components";
import { useGameId } from "@literature/store";
import { client } from "@stairway/clients/literature";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export function PreviousAsks() {
	const gameId = useGameId();
	const [ showDialog, setShowDialog ] = useState( false );
	const { data, isPending } = useQuery( {
		queryKey: [ "asks", gameId ],
		queryFn: () => client.getPreviousAsks.query( { gameId } )
	} );

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<Button onClick={ () => setShowDialog( true ) }>PREVIOUS ASKS</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Previous Asks</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					{ isPending || !data ? <Spinner/> : (
						data.map( move => (
							<Alert key={ move.id }>
								<AlertTitle>{ move.description }</AlertTitle>
							</Alert>
						) )
					) }
				</div>
				<DialogFooter/>
			</DialogContent>
		</Dialog>
	);
}