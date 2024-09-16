"use client";

import { Alert, AlertTitle, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@base/ui";
import { useState } from "react";
import { usePreviousMoves } from "../store";

export function PreviousMoves() {
	const moves = usePreviousMoves();
	const [ showDialog, setShowDialog ] = useState( false );

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<Button onClick={ () => setShowDialog( true ) }>PREVIOUS MOVES</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Previous Moves</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					{ moves.map( move => (
						<Alert key={ move.id }>
							<AlertTitle>{ move.description }</AlertTitle>
						</Alert>
					) ) }
				</div>
				<DialogFooter/>
			</DialogContent>
		</Dialog>
	);
}