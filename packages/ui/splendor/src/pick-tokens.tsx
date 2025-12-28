import { Button } from "@s2h-ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h-ui/primitives/drawer";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { usePickTokensMutation } from "@s2h/client/splendor";
import type { Gem } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { store } from "./store.tsx";

export function PickTokens() {
	const gameId = useStore( store, state => state.id );
	const [ selectedTokens, setSelectedTokens ] = useState<Exclude<Gem, "gold">[]>( [] );
	const [ open, setOpen ] = useState( false );

	const { mutateAsync, isPending } = usePickTokensMutation( {
		onSettled: () => closeDrawer()
	} );

	const openDrawer = () => setOpen( true );

	const closeDrawer = () => {
		setSelectedTokens( [] );
		setOpen( false );
	};

	const handleClick = () => mutateAsync( { gameId, tokens: selectedTokens } );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>PICK TOKENS</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>PICK TOKENS</DrawerTitle>
						<DrawerDescription/>
					</DrawerHeader>
					<div className={ "px-3 md:px-4" }>

					</div>
					<DrawerFooter>
						<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
							{ isPending ? <Spinner/> : "PICK TOKENS" }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
