import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useMemo, useState } from "react";
import { useBoolean } from "usehooks-ts";

import type { Tokens } from "@/games/splendor/schema";
import { SPLENDOR_MAX_TOKENS } from "@/games/splendor/schema";
import { pickTokensAtom } from "@/games/splendor/ui/client";
import { TokenPicker } from "@/games/splendor/ui/token-picker";
import { ALL_GEMS, sumTokens } from "@/games/splendor/utils";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { GameId } from "@/swish/schema";


export type PickTokensProps = {
	gameId: string;
	isMyTurn: boolean;
	availableTokens: Partial<Tokens>;
	playerTokens?: Partial<Tokens>;
};

export function PickTokens( { gameId, isMyTurn, availableTokens, playerTokens }: PickTokensProps ) {
	const pickTokens = useAtomSet( pickTokensAtom, { mode: "promiseExit" } );
	const isPending = useAtomValue( pickTokensAtom ).waiting;

	const { value, toggle, setTrue, setFalse } = useBoolean( false );
	const [ selectedTokens, setSelectedTokens ] = useState<Partial<Tokens>>( {} );
	const [ returnTokens, setReturnTokens ] = useState<Partial<Tokens>>( {} );

	const params = { gameId: GameId.make( gameId ) };

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
			void pickTokens( {
				params,
				payload: { tokens: selectedTokens }
			} ).then( reset );
		} else {
			setTrue();
		}
	};

	const handleReturnClick = () => void pickTokens( {
		params,
		payload: { tokens: selectedTokens, returned: returnTokens }
	} ).then( reset );

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
