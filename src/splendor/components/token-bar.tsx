import { Button } from "@/shared/primitives/button";
import { cn } from "@/shared/utils/cn";
import { gemColors } from "@/splendor/components/utils";
import type { Gem, Tokens } from "@/splendor/core/types";
import type { ReactNode } from "react";

export type TokenBarProps = {
	tokens: Partial<Tokens>;
	tokenText: string;
	onTokenClick: ( gem: Gem ) => void;
	action?: ReactNode;
	disabled?: boolean;
}

export function TokenBar( props: TokenBarProps ) {
	return (
		<div
			className={ cn(
				"flex gap-2 md:gap-3 bg-background rounded-md overflow-hidden",
				"w-full h-12 md:h-16 items-center justify-between"
			) }
		>
			<div
				className={ cn(
					"bg-accent p-1 h-full w-1/3 min-w-20 max-w-40 text-center",
					"flex items-center justify-center"
				) }
			>
				<span className={ "font-heading text-sm md:text-lg text-neutral-dark" }>
					{ props.tokenText }
				</span>
			</div>
			<div className={ "flex gap-2 md:gap-3 p-2 md:p-3 flex-1" }>
				{ Object.keys( props.tokens ).map( g => g as Gem ).map( gem => (
					<Button
						key={ gem }
						size={ "icon" }
						className={ cn( "rounded-full text-md md:text-xl", gemColors[ gem ] ) }
						disabled={ props.disabled || props.tokens[ gem ] === 0 }
						onClick={ () => props.onTokenClick( gem ) }
					>
						{ props.tokens[ gem ] }
					</Button>
				) ) }
			</div>
			<div className={ "p-2 justify-self-end" }>{ props.action }</div>
		</div>
	);
}