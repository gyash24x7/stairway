"use client";

import { orpc } from "@s2h/client/query";
import type { Gem, Tokens } from "@s2h/splendor/types";
import { GEMS_WITH_GOLD } from "@s2h/splendor/utils";
import { Button } from "@s2h/ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useTransition } from "react";
import { useBoolean } from "usehooks-ts";
import { useSplendor } from "./context";
import { TokenPicker } from "./token-picker";

export function PickTokens() {
	const { shared, player } = useSplendor();
	const queryClient = useQueryClient();

	const pickTokens = useMutation( orpc.splendor.pickTokens.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.splendor.getGame.key( { input: { gameId: shared.id } } )
		} )
	} ) );

	const availableTokens = shared.state.tokens;
	const playerTokens = shared.state.playerData[ player.playerId ].tokens;
	const isMyTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === player.playerId;

	const { value, toggle, setTrue, setFalse } = useBoolean( false );
	const [ selectedTokens, setSelectedTokens ] = useState<Partial<Tokens>>( {} );
	const [ returnTokens, setReturnTokens ] = useState<Partial<Tokens>>( {} );
	const [ isPending, startTransition ] = useTransition();

	const projectedTotal = useMemo( () => {
		const currentTotal = GEMS_WITH_GOLD.reduce( ( sum, gem ) => sum + playerTokens[ gem ], 0 );
		const pickedTotal = Object.values( selectedTokens )
			.reduce( ( sum, val ) => sum + val, 0 );

		return currentTotal + pickedTotal;
	}, [ playerTokens, selectedTokens ] );

	const tokensAfterPick = useMemo( () => {
		const result = { ...playerTokens };
		for ( const gem of GEMS_WITH_GOLD ) {
			result[ gem ] += ( selectedTokens[ gem as Gem ] ?? 0 );
		}
		return result;
	}, [ playerTokens, selectedTokens ] );

	const reset = () => {
		setSelectedTokens( {} );
		setReturnTokens( {} );
		setFalse();
	};

	const handlePickClick = () => startTransition( async () => {
		if ( projectedTotal <= 10 ) {
			await pickTokens.mutateAsync( { gameId: shared.id, tokens: selectedTokens } );
			reset();
		} else {
			setTrue();
		}
	} );

	const handleReturnClick = () => startTransition( async () => {
		await pickTokens.mutateAsync( {
			gameId: shared.id,
			tokens: selectedTokens,
			returned: returnTokens
		} );
		reset();
	} );

	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<TokenPicker
				initialTokens={ availableTokens }
				pickLimit={ 3 }
				sourceText={ "Available Tokens" }
				sinkText={ "Selected Tokens" }
				onPickChange={ setSelectedTokens }
				disabled={ !isMyTurn }
				action={
					<Button onClick={ handlePickClick } disabled={ isPending || !isMyTurn }>
						{ isPending ? <Spinner/> : "PICK" }
					</Button>
				}
			/>
			<Drawer open={ value } onOpenChange={ toggle }>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle className={ "font-bold" }>RETURN TOKENS</DrawerTitle>
						<DrawerDescription>
							Return { projectedTotal - 10 } token(s)
						</DrawerDescription>
					</DrawerHeader>
					<div className={ "px-4 overflow-y-auto flex flex-col gap-2" }>
						<TokenPicker
							sourceText={ "My Tokens" }
							sinkText={ "Returning" }
							initialTokens={ tokensAfterPick }
							pickLimit={ projectedTotal - 10 }
							onPickChange={ setReturnTokens }
						/>
					</div>
					<DrawerFooter>
						<Button
							onClick={ handleReturnClick }
							disabled={ isPending ||
								Object.values( returnTokens ).reduce( ( acc, v ) => acc + v, 0 ) === 0 }
							className={ "w-full" }
						>
							{ isPending ? <Spinner/> : "RETURN TOKENS" }
						</Button>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</div>
	);
}
