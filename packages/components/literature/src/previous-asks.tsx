import { Button, Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@stairway/components/base";
import { usePreviousAsks } from "@stairway/stores/literature";
import { useState } from "react";

export function PreviousAsks() {
	const [ showDrawer, setShowDrawer ] = useState( false );
	const asks = usePreviousAsks();

	const openDrawer = () => setShowDrawer( true );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>
				PREVIOUS ASKS
			</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>Previous Asks</DrawerTitle>
					</DrawerHeader>
					<div className={ "flex flex-col gap-3 px-4" }>
						{ asks.slice( 0, 5 ).map( ask => (
							<div className={ "p-3 border-2 rounded-md" } key={ ask.id }>
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