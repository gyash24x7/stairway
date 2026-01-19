import type { Gem, Tokens } from "@s2h/splendor/types";
import { DEFAULT_TOKENS } from "@s2h/splendor/utils";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { TokenBar } from "./token-bar.tsx";

export const gemColors: Record<Gem, string> = {
	diamond: "bg-gray-100 text-gray-600",
	onyx: "bg-gray-800 text-gray-200",
	ruby: "bg-apple",
	sapphire: "bg-blueberry",
	emerald: "bg-kiwi",
	gold: "bg-mango"
};

export const gemLightColors: Record<Gem, string> = {
	diamond: "bg-gray-100 text-gray-600",
	onyx: "bg-neutral-dark text-gray-200",
	ruby: "bg-surface-apple text-apple",
	sapphire: "bg-surface-blueberry text-blueberry",
	emerald: "bg-surface-kiwi text-kiwi",
	gold: "bg-surface-mango text-mango"
};

type TokenPickerProps = {
	initialTokens: Partial<Tokens>;
	pickLimit?: number;
	allowGold?: boolean;
	onPickChange?: ( pickedTokens: Partial<Tokens> ) => void;
	sourceText?: string;
	sinkText?: string;
	action?: ReactNode
}

export function TokenPicker( { initialTokens, pickLimit, ...props }: TokenPickerProps ) {
	const [ tokens, setTokens ] = useState<Tokens>( DEFAULT_TOKENS );
	const [ pickedTokens, setPickedTokens ] = useState<Partial<Tokens>>( {} );

	const handleTokenSelection = ( gem: Gem ) => {
		if ( !props.allowGold && gem === "gold" ) {
			return;
		}

		const pickedCount = Object.values( pickedTokens ).reduce( ( acc, num ) => acc + ( num || 0 ), 0 );
		if ( pickLimit && pickedCount >= pickLimit ) {
			return;
		}

		const newTokens = { ...tokens, [ gem ]: tokens[ gem ] - 1 };
		setTokens( newTokens );

		const newPicked = { ...pickedTokens, [ gem ]: ( pickedTokens[ gem ] || 0 ) + 1 };
		setPickedTokens( newPicked );

		props.onPickChange?.( newPicked );
	};

	const handleTokenDeSelection = ( gem: Gem ) => {
		if ( !props.allowGold && gem === "gold" ) {
			return;
		}

		const newTokens = { ...tokens, [ gem ]: tokens[ gem ] + 1 };
		setTokens( newTokens );

		const newPicked = { ...pickedTokens, [ gem ]: ( pickedTokens[ gem ] || 0 ) - 1 };
		if ( newPicked[ gem ] === 0 ) {
			delete newPicked[ gem ];
		}

		setPickedTokens( newPicked );
		props.onPickChange?.( newPicked );
	};

	useEffect( () => {
		setTokens( { ...tokens, ...initialTokens } );
		setPickedTokens( {} );
	}, [ initialTokens ] );

	return (
		<Fragment>
			<TokenBar
				tokens={ tokens }
				tokenText={ props.sourceText ?? "TOKENS" }
				onTokenClick={ handleTokenSelection }
			/>
			<TokenBar
				tokens={ pickedTokens }
				tokenText={ props.sinkText ?? "TOKENS" }
				onTokenClick={ handleTokenDeSelection }
				action={ props.action }
			/>
		</Fragment>
	);
}