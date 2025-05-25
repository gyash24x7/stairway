"use client";

import { cn } from "@/shared/utils/cn";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";

const { Root } = SeparatorPrimitive;

export const Separator = forwardRef<ComponentRef<typeof Root>, ComponentPropsWithoutRef<typeof Root>>(
	( { className, orientation = "horizontal", decorative = true, ...props }, ref ) => (
		<Root
			ref={ ref }
			decorative={ decorative }
			orientation={ orientation }
			className={ cn(
				"shrink-0 bg-border",
				orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
				className
			) }
			{ ...props }
		/>
	)
);
