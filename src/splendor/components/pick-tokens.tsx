"use client";

import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/primitives/dialog";
import { Spinner } from "@/shared/primitives/spinner";
import { useSplendor } from "@/splendor/components/context";
import { TokenPicker } from "@/splendor/components/token-picker";
import { pickTokens } from "@/splendor/core/actions";
import type { Gem, Tokens } from "@/splendor/core/types";
import { GEMS_WITH_GOLD } from "@/splendor/core/utils";
import { useMemo, useState, useTransition } from "react";
import { useBoolean } from "usehooks-ts";

export function PickTokens() {
	const { shared, player } = useSplendor();

	const isMyTurn = shared.status === "IN_PROGRESS" && shared.context.currentPlayer === player.playerId;
	const availableTokens = shared.state.tokens;
	const playerTokens = shared.state.playerData[ player.playerId ].tokens;

	const { value, toggle, setTrue, setFalse } = useBoolean( false );
	const [ selectedTokens, setSelectedTokens ] = useState<Partial<Tokens>>( {} );
	const [ returnTokens, setReturnTokens ] = useState<Partial<Tokens>>( {} );
	const [ isPending, startTransition ] = useTransition();

	const projectedTotal = useMemo( () => {
		const currentTotal = GEMS_WITH_GOLD.reduce( ( sum, gem ) => sum + playerTokens[ gem ], 0 );
		const pickedTotal = Object.values( selectedTokens ).reduce( ( sum, val ) => sum + ( val ?? 0 ), 0 );
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
			await pickTokens( { gameId: shared.id, tokens: selectedTokens } );
			reset();
		} else {
			setTrue();
		}
	} );

	const handleReturnClick = () => startTransition( async () => {
		await pickTokens( { gameId: shared.id, tokens: selectedTokens, returned: returnTokens } );
		reset();
	} );

	return (
		<div className={ "flex flex-col gap-3" }>
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
			<Dialog open={ value } onOpenChange={ toggle }>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className={ "font-bold" }>RETURN TOKENS</DialogTitle>
						<DialogDescription/>
					</DialogHeader>
					<TokenPicker
						initialTokens={ tokensAfterPick }
						pickLimit={ projectedTotal - 10 }
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
