import type { ReactNode } from "react";

import type { Gem, Tokens } from "@/games/splendor/shared/schema.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { gemColors } from "@/games/splendor/client/utils.tsx";

export type TokenBarProps = {
	tokens: Partial<Tokens>;
	tokenText: string;
	onTokenClick: ( gem: Gem ) => void;
	action?: ReactNode;
	disabled?: boolean;
	/** Television sizing — readable from across a room. Used by the couch screen. */
	large?: boolean;
}

export function TokenBar( props: TokenBarProps ) {
	const { large } = props;

	return (
		<div
			className={ cn(
				"flex gap-2 md:gap-3 bg-background rounded-md overflow-hidden",
				"w-full h-12 md:h-16 items-center justify-between",
				large && "h-20 md:h-24 rounded-xl gap-4 shrink-0"
			) }
		>
			<div
				className={ cn(
					"bg-accent p-1 h-full w-24 md:w-32 shrink-0 text-center",
					"flex items-center justify-center",
					large && "w-36 md:w-44 p-2"
				) }
			>
				<span
					className={ cn(
						"text-sm md:text-lg text-neutral-dark",
						large && "text-2xl md:text-3xl font-heading"
					) }
				>
					{ props.tokenText.toUpperCase() }
				</span>
			</div>
			<div className={ cn( "flex gap-2 md:gap-3 p-2 md:p-3 flex-1", large && "gap-4 p-4" ) }>
				{ Object.keys( props.tokens ).map( g => g as Gem ).map( gem => (
					<Button
						key={ gem }
						size={ "icon" }
						className={ cn(
							"rounded-full text-md md:text-xl",
							gemColors[ gem ],
							large && "h-14 w-14 md:h-16 md:w-16 text-3xl md:text-4xl font-heading"
						) }
						disabled={ props.disabled || props.tokens[ gem ] === 0 }
						onClick={ () => props.onTokenClick( gem ) }
					>
						{ props.tokens[ gem ] }
					</Button>
				) ) }
			</div>
			<div className={ cn( "p-2 justify-self-end", large && "p-4" ) }>{ props.action }</div>
		</div>
	);
}
