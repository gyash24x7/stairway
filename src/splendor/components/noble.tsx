import { cn } from "@/shared/utils/cn";
import { gemColors } from "@/splendor/components/utils";
import type { Cost, Noble } from "@/splendor/core/types";

export function Noble( { noble }: { noble: Noble } ) {
	return (
		<div
			className={ cn(
				"border-4 border-gray-400 rounded-lg",
				"w-16 md:w-20 h-16 md:h-20 text-neutral-dark",
				"flex overflow-hidden justify-between gap-1 bg-background"
			) }
		>
			<div className={ "flex flex-col flex-1 justify-between" }>
				<div
					className={ cn(
						"rounded-br-full rounded-tl-md bg-accent w-6 -px-1 h-6",
						"flex items-center justify-center text-neutral-dark"
					) }
				>
					<div className={ "text-sm leading-none -ml-1.5 mb-1" }>
						{ noble.points ?? 0 }
					</div>
				</div>
				<img src={ `/splendor/noble.svg` } className={ cn( "w-8" ) }/>
			</div>
			<div className={ "flex flex-col gap-1 p-1" }>
				{ Object.keys( noble.cost )
					.map( g => g as keyof Cost )
					.filter( gem => noble.cost[ gem ] > 0 )
					.map( gem => (
						<div
							key={ gem }
							className={ cn(
								"flex rounded-md justify-center items-center h-6 w-5",
								"border border-dotted border-gray-400",
								gemColors[ gem ]
							) }
						>
							<span className={ "text-[10px] md:text-xs" }>
								{ noble.cost[ gem ] }
							</span>
						</div>
					) ) }
			</div>
		</div>
	);
}

export function NobleBack() {
	return (
		<div
			className={ cn(
				"w-16 md:w-20 h-16 md:h-20 p-1",
				"rounded-lg flex justify-center items-center",
				"text-xl font-bold",
				"bg-background border-4 border-gray-400"
			) }
		>
			<img
				src={ `/splendor/noble.svg` }
				className={ cn( "w-8" ) }
			/>
		</div>
	);
}