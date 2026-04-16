"use client";

import { useFish } from "@/fish/components/context";
import { getAskDescription } from "@/fish/core/utils";
import { Button } from "@/shared/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/primitives/dialog";
import { useState } from "react";

export function AskHistory() {
	const { game } = useFish();
	const [ showDialog, setShowDialog ] = useState( false );
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
				{ game.state.askHistory.slice( 0, 5 ).map( ask => (
					<div className={ "p-3 bg-background rounded-md" } key={ ask.timestamp }>
						<p>{ getAskDescription( ask, game.players ).toUpperCase() }</p>
					</div>
				) ) }
				<DialogFooter/>
			</DialogContent>
		</Dialog>
	);
}