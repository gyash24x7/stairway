import { Button } from "@s2h-ui/primitives/button";
import { Separator } from "@s2h-ui/primitives/separator";
import { cn } from "@s2h-ui/primitives/utils";
import type { Gem, Tokens } from "@s2h/splendor/types";
import { DEFAULT_TOKENS } from "@s2h/splendor/utils";
import { Fragment, useEffect, useState } from "react";

export const gemColors: Record<Gem, string> = {
	diamond: "bg-white text-neutral-dark",
	onyx: "bg-neutral-dark text-white",
	ruby: "bg-apple",
	sapphire: "bg-blueberry",
	emerald: "bg-kiwi",
	gold: "bg-mango"
};

type TokenPickerProps = {
	initialTokens: Tokens;
	pickLimit?: number;
	allowGold?: boolean;
	onPickChange?: ( pickedTokens: Partial<Tokens> ) => void;
}

export function TokenPicker( { initialTokens = DEFAULT_TOKENS, pickLimit, ...props }: TokenPickerProps ) {
	const [ tokens, setTokens ] = useState<Tokens>( initialTokens );
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
		if ( gem === "gold" ) {
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
		setTokens( initialTokens );
		setPickedTokens( {} );
	}, [ initialTokens ] );

	return (
		<Fragment>
			<div className={ "flex-1" }>
				<h2 className={ "mb-2" }>Available Tokens</h2>
				<div className={ "flex flex-wrap gap-2" }>
					{ Object.keys( tokens ).map( g => g as Gem ).map( ( gem ) => (
						<Button
							key={ gem }
							size={ "smallIcon" }
							className={ cn( "rounded-full", gemColors[ gem ] ) }
							onClick={ () => handleTokenSelection( gem ) }
							disabled={ tokens[ gem ] === 0 }
						>
							{ tokens[ gem ] }
						</Button>
					) ) }
				</div>
			</div>
			<Separator orientation={ "vertical" } className={ "h-inherit" }/>
			<div className={ "w-1/3" }>
				<h2 className={ "mb-2" }>Selected</h2>
				<div className={ "flex flex-wrap gap-2" }>
					{ Object.keys( pickedTokens )
						.map( g => g as Gem )
						.filter( g => !!pickedTokens[ g ] )
						.map( ( gem ) => (
							<Button
								key={ gem }
								size={ "smallIcon" }
								className={ cn( "rounded-full", gemColors[ gem ] ) }
								onClick={ () => handleTokenDeSelection( gem ) }
							>
								{ pickedTokens[ gem ] }
							</Button>
						) ) }
				</div>
			</div>
		</Fragment>
	);
}