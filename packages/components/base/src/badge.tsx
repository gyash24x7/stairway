import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

const badgeVariants = cva(
	cn(
		"inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs",
		"transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	),
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
				secondary: "border-transparent bg-secondary text-primary-foreground hover:bg-secondary/80",
				destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
				outline: "text-foreground"
			},
			large: {
				true: "h-10 text-md px-4 py-1"
			}
		},
		defaultVariants: {
			variant: "default",
			large: false
		}
	}
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge( { className, variant, large, ...props }: BadgeProps ) {
	return (
		<div className={ cn( badgeVariants( { variant, large } ), className ) } { ...props } />
	);
}

export { Badge, badgeVariants };
