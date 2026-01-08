import { cn } from "@s2h-ui/primitives/utils";
import type { Cost, Noble } from "@s2h/splendor/types";
import { gemColors } from "./token-picker.tsx";

export function DisplayNoble( { noble }: { noble: Noble } ) {
	return (
		<div
			className={
				cn(
					"flex flex-col justify-between bg-gray-400 rounded-lg",
					"p-1 gap-0.5 border-2 w-16 md:w-20 h-16 md:h-20 text-neutral-dark"
				)
			}
		>
			<div className={ "flex flex-1 rounded border overflow-hidden justify-between gap-0.5 bg-background" }>
				<div className={ "flex flex-col flex-1 justify-between" }>
					<div
						className={
							cn(
								"rounded-br-full rounded-tl-md bg-amber-400 w-6 -px-1 h-6",
								"flex items-center justify-center border-b border-r text-neutral-dark"
							)
						}
					>
						<div className={ "text-sm leading-none -ml-1.5 mb-1" }>
							{ noble.points ?? 0 }
						</div>
					</div>
					<img
						src={ `/splendor/noble.svg` }
						className={ cn( "w-8" ) }
					/>
				</div>
				<div className={ "flex flex-col gap-0.5 p-0.5" }>
					{ Object.keys( noble.cost ).map( g => g as keyof Cost ).filter( gem => noble.cost[ gem ] > 0 ).map( gem => (
						<div
							key={ gem }
							className={ cn(
								"flex rounded-md justify-center items-center border w-5",
								gemColors[ gem ]
							) }
						>
							<span className={ "text-[10px] md:text-xs" }>{ noble.cost[ gem ] }</span>
						</div>
					) ) }
				</div>
			</div>
		</div>
	);
}

export function DisplayNobleBack() {
	return (
		<div
			className={ "w-16 md:w-20 h-16 md:h-20 rounded-lg bg-gray-400 flex items-center justify-center p-1 border-2" }>
			<div className={ cn(
				"h-full w-full rounded-md border flex justify-center items-center",
				"text-xl font-bold",
				"bg-background"
			) }>
				<img
					src={ `/splendor/noble.svg` }
					className={ cn( "w-8" ) }
				/>
			</div>
		</div>
	);
}