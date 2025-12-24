import { Separator as Root } from "@base-ui/react/separator";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import { cn } from "./utils.tsx";

export const Separator = forwardRef<ComponentRef<typeof Root>, ComponentPropsWithoutRef<typeof Root>>(
	( { className, orientation = "horizontal", ...props }, ref ) => (
		<Root
			ref={ ref }
			orientation={ orientation }
			className={ cn(
				"shrink-0 bg-foreground",
				orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
				className
			) }
			{ ...props }
		/>
	)
);
