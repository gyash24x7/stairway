import { Button } from "@s2h-ui/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@s2h-ui/primitives/dialog";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { usePickTokensMutation } from "@s2h/client/splendor";
import type { Gem } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import { useBoolean } from "usehooks-ts";
import { handleSelectedReturnTokenChange, handleSelectedTokenChange, store } from "./store.tsx";
import { TokenPicker } from "./token-picker.tsx";

export function PickTokens() {
	const gameId = useStore( store, state => state.id );
	const selectedTokens = useStore( store, state => state.local.selectedTokens );
	const selectedReturnTokens = useStore( store, state => state.local.selectedReturnTokens );
	const combinedTokens = useStore( store, state => {
		const combined: Record<Gem, number> = { ...state.players[ state.playerId ].tokens };
		Object.keys( state.local.selectedTokens ).map( g => g as Gem ).forEach( gem => {
			combined[ gem ] = ( combined[ gem ] || 0 ) + ( state.local.selectedTokens[ gem ] || 0 );
		} );
		return combined;
	} );

	const selectedCount = Object.values( selectedTokens ).reduce( ( sum, val ) => sum + ( val || 0 ), 0 );
	const combinedCount = Object.values( combinedTokens ).reduce( ( sum, val ) => sum + ( val || 0 ), 0 );

	const { value, toggle, setTrue, setFalse } = useBoolean( false );

	const { mutateAsync, isPending } = usePickTokensMutation( {
		onSuccess: () => {
			handleSelectedTokenChange( {} );
		}
	} );

	const handlePickClick = async () => {
		if ( combinedCount <= 10 ) {
			await mutateAsync( { gameId, tokens: selectedTokens } );
		} else {
			setTrue();
		}
	};

	const handleReturnClick = async () => {
		await mutateAsync( { gameId, tokens: selectedTokens, returned: selectedReturnTokens } );
		setFalse();
	};

	return (
		<Fragment>
			<Button onClick={ handlePickClick } disabled={ isPending || selectedCount === 0 } className={ "flex-1" }>
				{ isPending ? <Spinner/> : "PICK TOKENS" }
			</Button>
			<Dialog open={ value } onOpenChange={ toggle }>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className={ "font-bold" }>RETURN TOKENS</DialogTitle>
						<DialogDescription/>
					</DialogHeader>
					<TokenPicker
						initialTokens={ combinedTokens }
						pickLimit={ combinedCount - 10 }
						onPickChange={ handleSelectedReturnTokenChange }
					/>
					<DialogFooter>
						<Button onClick={ handleReturnClick } disabled={ isPending } className={ "w-full" }>
							{ isPending ? <Spinner/> : "RETURN TOKENS" }
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Fragment>
	);
}
