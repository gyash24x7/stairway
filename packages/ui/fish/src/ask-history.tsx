import { Button } from "@s2h-ui/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@s2h-ui/primitives/dialog";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { store } from "./store.tsx";

export function AskHistory() {
	const [ showDialog, setShowDialog ] = useState( false );
	const asks = useStore( store, state => state.askHistory );

	const openDialog = () => setShowDialog( true );

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<Button onClick={ openDialog } className={ "flex-1 max-w-lg" }>
				ASK HISTORY
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>ASK HISTORY</DialogTitle>
				</DialogHeader>
				{ asks.slice( 0, 5 ).map( ask => (
					<div className={ "p-3 bg-background rounded-md" } key={ ask.timestamp }>
						<p>{ ask.description.toUpperCase() }</p>
					</div>
				) ) }
				<DialogFooter/>
			</DialogContent>
		</Dialog>
	);
}