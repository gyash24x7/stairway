import { cn } from "@/shared/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
	cn(
		"inline-flex items-center rounded-base border-2 border-border px-2.5 py-0.5 text-xs font-base",
		"transition-colors focus:outline-hidden focus:ring-2 focus:ring-black focus:ring-offset-2"
	),
	{
		variants: {
			variant: {
				default: "bg-main text-main-foreground",
				outline: "bg-secondary-background text-main-foreground"
			}
		},
		defaultVariants: {
			variant: "default"
		}
	}
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge( { className, variant, ...props }: BadgeProps ) {
	return <div className={ cn( badgeVariants( { variant } ), className ) } { ...props } />;
}

