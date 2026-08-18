"use client";

import { useMemo, useState } from "react";
import { useBoolean } from "usehooks-ts";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { TokenPicker } from "@/games/splendor/client/token-picker.tsx";
import { SPLENDOR_MAX_TOKENS } from "@/games/splendor/shared/schema.ts";
import { ALL_GEMS, sumTokens } from "@/games/splendor/shared/utils.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

import type { Tokens } from "@/games/splendor/shared/schema.ts";

export function PickTokens() {
	const { data, playerId, isMyTurn, pickTokens, isPending } = useSplendor();

	const { value, toggle, setTrue, setFalse } = useBoolean( false );
	const [ selectedTokens, setSelectedTokens ] = useState<Partial<Tokens>>( {} );
	const [ returnTokens, setReturnTokens ] = useState<Partial<Tokens>>( {} );

	const availableTokens = data.view.tokens;
	const playerTokens = playerId ? data.view.playerData[ playerId ]?.tokens : undefined;

	const projectedTotal = useMemo(
		() => sumTokens( playerTokens ?? {} ) + sumTokens( selectedTokens ),
		[ playerTokens, selectedTokens ]
	);

	const tokensAfterPick = useMemo(
		() => Object.fromEntries( ALL_GEMS.map( gem => [
			gem,
			( playerTokens?.[ gem ] ?? 0 ) + ( selectedTokens[ gem ] ?? 0 )
		] ) ) as Partial<Tokens>,
		[ playerTokens, selectedTokens ]
	);

	const reset = () => {
		setSelectedTokens( {} );
		setReturnTokens( {} );
		setFalse();
	};

	// Going over the limit has to be settled inside the same move, so a pick that
	// would carry the seat past it opens the return sheet rather than being sent.
	const handlePickClick = () => {
		if ( projectedTotal <= SPLENDOR_MAX_TOKENS ) {
			pickTokens( { tokens: selectedTokens }, reset );
		} else {
			setTrue();
		}
	};

	const handleReturnClick = () => {
		pickTokens( { tokens: selectedTokens, returned: returnTokens }, reset );
	};

	if ( !playerTokens ) {
		return null;
	}

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
					<Button
						onClick={ handlePickClick }
						disabled={ isPending || !isMyTurn || sumTokens( selectedTokens ) === 0 }
					>
						{ isPending ? <Spinner/> : "PICK" }
					</Button>
				}
			/>
			<Drawer open={ value } onOpenChange={ toggle }>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle className={ "font-bold" }>RETURN TOKENS</DrawerTitle>
						<DrawerDescription>
							Return { projectedTotal - SPLENDOR_MAX_TOKENS } token(s)
						</DrawerDescription>
					</DrawerHeader>
					<div className={ "px-4 flex flex-col gap-2 overflow-y-scroll max-h-100" }>
						<TokenPicker
							sourceText={ "My Tokens" }
							sinkText={ "Returning" }
							initialTokens={ tokensAfterPick }
							pickLimit={ projectedTotal - SPLENDOR_MAX_TOKENS }
							allowGold
							onPickChange={ setReturnTokens }
						/>
					</div>
					<DrawerFooter>
						<Button
							onClick={ handleReturnClick }
							disabled={ isPending
								|| sumTokens( returnTokens ) !== projectedTotal - SPLENDOR_MAX_TOKENS }
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
