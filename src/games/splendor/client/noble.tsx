import { gemColors } from "@/games/splendor/client/utils.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { Cost, Noble as NobleType } from "@/games/splendor/shared/schema.ts";

/** Television sizing for the noble row. Square, so a fixed size rather than an aspect. */
const nobleSize = ( large?: boolean ) => large
	? "w-20 h-20 md:w-25 md:h-25"
	: "w-16 md:w-20 h-16 md:h-20";

export function Noble( { noble, large }: { noble: NobleType; large?: boolean } ) {
	return (
		<div
			className={ cn(
				"border-3 border-outline rounded-lg",
				nobleSize( large ),
				"text-neutral-dark",
				"flex overflow-hidden justify-between gap-1 bg-background",
				large && "border-4 rounded-xl"
			) }
		>
			<div className={ "flex flex-col flex-1 justify-between" }>
				<div
					className={ cn(
						"rounded-br-full rounded-tl-md bg-accent w-6 -px-1 h-6",
						"flex items-center justify-center text-neutral-dark",
						large && "w-9 h-9"
					) }
				>
					<div
						className={ cn(
							"text-sm leading-none -ml-1.5 mb-1",
							large && "text-xl -ml-2 mb-2"
						) }
					>
						{ noble.points ?? 0 }
					</div>
				</div>
				<img
					src={ "/splendor/noble.svg" }
					className={ cn( "w-8", large && "w-14" ) }
				/>
			</div>
			<div className={ cn( "flex flex-col gap-0.5 md:gap-1 p-1", large && "gap-1.5 p-2" ) }>
				{ Object.keys( noble.cost )
					.map( g => g as keyof Cost )
					.filter( gem => noble.cost[ gem ] > 0 )
					.map( gem => (
						<div
							key={ gem }
							className={ cn(
								"flex rounded-md justify-center items-center h-6 w-5",
								"border border-dotted border-outline",
								large && "h-8 w-7 border-2",
								gemColors[ gem ]
							) }
						>
							<span className={ cn( "text-[10px] md:text-xs", large && "text-base" ) }>
								{ noble.cost[ gem ] }
							</span>
						</div>
					) ) }
			</div>
		</div>
	);
}

export function NobleBack( props: { large?: boolean } = {} ) {
	return (
		<div
			className={ cn(
				nobleSize( props.large ),
				"p-1 rounded-lg flex justify-center items-center",
				"text-xl font-bold",
				"bg-background border-3 border-outline",
				props.large && "border-4 rounded-xl"
			) }
		>
			<img
				src={ "/splendor/noble.svg" }
				className={ cn( "w-8", props.large && "w-16" ) }
			/>
		</div>
	);
}

export function EmptyNoble( props: { large?: boolean } ) {
	return (
		<div
			className={ cn(
				nobleSize( props.large ),
				"rounded-md border-2 border-dashed border-gray-300",
				props.large && "border-4 rounded-xl"
			) }
		/>
	);
}
