import { Button } from "@s2h-ui/primitives/button";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { usePickTokensMutation } from "@s2h/client/splendor";
import { useStore } from "@tanstack/react-store";
import { handleSelectedTokenChange, store } from "./store.tsx";

export function PickTokens() {
	const gameId = useStore( store, state => state.id );
	const selectedTokens = useStore( store, state => state.local.selectedTokens );
	const selectedCount = Object.values( selectedTokens ).reduce( ( sum, val ) => sum + ( val || 0 ), 0 );
	const { mutateAsync, isPending } = usePickTokensMutation( {
		onSuccess: () => {
			handleSelectedTokenChange( {} );
		}
	} );

	const handleClick = () => mutateAsync( { gameId, tokens: selectedTokens } );

	return (
		<Button onClick={ handleClick } disabled={ isPending || selectedCount === 0 } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "PICK TOKENS" }
		</Button>
	);
}
