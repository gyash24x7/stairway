import { Separator as Root } from "@base-ui-components/react/separator";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import { cn } from "./utils";

export const Separator = forwardRef<ComponentRef<typeof Root>, ComponentPropsWithoutRef<typeof Root>>(
	( { className, orientation = "horizontal", ...props }, ref ) => (
		<Root
			ref={ ref }
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
