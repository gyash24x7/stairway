import {
	Alert,
	AlertTitle,
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	Spinner
} from "@base/components";
import { useGameId } from "@literature/store";
import { client } from "@stairway/clients/literature";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export function PreviousAsks() {
	const gameId = useGameId();
	const [ showDrawer, setShowDrawer ] = useState( false );
	const { data, isPending } = useQuery( {
		queryKey: [ "asks", gameId ],
		queryFn: () => client.getPreviousAsks.query( { gameId } )
	} );

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
						{ isPending || !data ? <Spinner/> : (
							data.map( move => (
								<Alert key={ move.id } className={ "bg-accent" }>
									<AlertTitle>{ move.description }</AlertTitle>
								</Alert>
							) )
						) }
					</div>
					<DrawerFooter/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}