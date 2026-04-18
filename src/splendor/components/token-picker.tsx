"use client";

import { TokenBar } from "@/splendor/components/token-bar";
import type { Gem, Tokens } from "@/splendor/core/types";
import { DEFAULT_TOKENS } from "@/splendor/core/utils";
import { Fragment, type ReactNode, useEffect, useState } from "react";

type TokenPickerProps = {
	initialTokens: Partial<Tokens>;
	pickLimit?: number;
	allowGold?: boolean;
	onPickChange?: ( pickedTokens: Partial<Tokens> ) => void;
	sourceText?: string;
	sinkText?: string;
	action?: ReactNode;
	disabled?: boolean;
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
		setTokens( { ...DEFAULT_TOKENS, ...initialTokens } );
		setPickedTokens( {} );
	}, [ initialTokens ] );

	return (
		<Fragment>
			<TokenBar
				tokens={ tokens }
				tokenText={ props.sourceText ?? "TOKENS" }
				onTokenClick={ handleTokenSelection }
				disabled={ props.disabled }
			/>
			<TokenBar
				tokens={ pickedTokens }
				tokenText={ props.sinkText ?? "TOKENS" }
				onTokenClick={ handleTokenDeSelection }
				action={ props.action }
				disabled={ props.disabled }
			/>
		</Fragment>
	);
}