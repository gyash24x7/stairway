import { Button } from "@s2h-ui/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@s2h-ui/primitives/drawer";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { store } from "./store";

export function AskHistory() {
	const [ showDrawer, setShowDrawer ] = useState( false );
	const asks = useStore( store, state => state.askHistory );

	const openDrawer = () => setShowDrawer( true );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>
				ASK HISTORY
			</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>ASK HISTORY</DrawerTitle>
					</DrawerHeader>
					<div className={ "flex flex-col gap-3 px-4" }>
						{ asks.slice( 0, 5 ).map( ask => (
							<div className={ "p-3 border-2 rounded-md" } key={ ask.timestamp }>
								<p>{ ask.description }</p>
							</div>
						) ) }
					</div>
					<DrawerFooter/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}