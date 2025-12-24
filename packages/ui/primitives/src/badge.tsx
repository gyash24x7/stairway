import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./utils.tsx";

export const badgeVariants = cva(
	cn(
		"inline-flex items-center justify-center rounded-base border-2 border-black",
		"px-2.5 py-0.5 text-xs font-base w-fit whitespace-nowrap shrink-0 [&>svg]:size-3",
		"gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50",
		"focus-visible:ring-[3px] overflow-hidden"
	),
	{
		variants: {
			variant: {
				default: "bg-accent text-neutral-dark",
				neutral: "bg-background text-foreground"
			}
		},
		defaultVariants: {
			variant: "default"
		}
	}
);

export function Badge( { className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants> ) {
	return (
		<span
			data-slot="badge"
			className={ cn( badgeVariants( { variant } ), className ) }
			{ ...props }
		/>
	);
}
