import {
	Alert,
	AlertTitle,
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@base/components";
import { usePreviousAsks } from "@literature/store";
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
						{ asks.map( ask => (
							<Alert key={ ask.id } className={ "bg-accent" }>
								<AlertTitle>{ ask.description }</AlertTitle>
							</Alert>
						) ) }
					</div>
					<DrawerFooter/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}