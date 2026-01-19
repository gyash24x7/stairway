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
import type { Tokens } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { useBoolean } from "usehooks-ts";
import { store } from "./store.tsx";
import { TokenPicker } from "./token-picker.tsx";

export function PickTokens() {
	const gameId = useStore( store, state => state.id );
	const availableTokens = useStore( store, state => state.tokens );
	const playerTokens = useStore( store, state => state.players[ state.playerId ].tokens );

	const { value, toggle, setTrue, setFalse } = useBoolean( false );
	const [ selectedTokens, setSelectedTokens ] = useState<Partial<Tokens>>( {} );
	const [ tokensAfterSelect, setTokensAfterSelect ] = useState<Partial<Tokens>>( playerTokens );
	const [ returnTokens, setReturnTokens ] = useState<Partial<Tokens>>( {} );

	const { mutateAsync, isPending } = usePickTokensMutation( {
		onSuccess: () => {
			setSelectedTokens( {} );
			setReturnTokens( {} );
			setTokensAfterSelect( playerTokens );
			setFalse();
		}
	} );

	const handlePickChange = ( tokens: Partial<Tokens> ) => {
		setSelectedTokens( tokens );
	};

	const handlePickClick = async () => {
		if ( Object.values( tokensAfterSelect ).reduce( ( sum, val ) => sum + val ) <= 10 ) {
			await mutateAsync( { gameId, tokens: selectedTokens } );
		} else {
			setTrue();
		}
	};

	const handleReturnClick = async () => {
		await mutateAsync( { gameId, tokens: selectedTokens, returned: returnTokens } );
	};

	return (
		<div className={ "flex flex-col gap-3" }>
			<TokenPicker
				initialTokens={ availableTokens }
				pickLimit={ 3 }
				sourceText={ "Available Tokens" }
				sinkText={ "Selected Tokens" }
				onPickChange={ handlePickChange }
				action={
					<Button onClick={ handlePickClick } disabled={ isPending }>
						{ isPending ? <Spinner/> : "PICK" }
					</Button>
				}
			/>
			<Dialog open={ value } onOpenChange={ toggle }>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className={ "font-bold" }>RETURN TOKENS</DialogTitle>
						<DialogDescription/>
					</DialogHeader>
					<TokenPicker
						initialTokens={ tokensAfterSelect }
						pickLimit={ Object.values( tokensAfterSelect ).reduce( ( sum, val ) => sum + val ) - 10 }
						onPickChange={ setReturnTokens }
					/>
					<DialogFooter>
						<Button onClick={ handleReturnClick } disabled={ isPending } className={ "w-full" }>
							{ isPending ? <Spinner/> : "RETURN TOKENS" }
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
