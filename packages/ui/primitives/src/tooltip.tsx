"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { ComponentProps } from "react";
import { cn } from "./utils.tsx";

const { Provider, Root, Trigger, Popup } = TooltipPrimitive;

export function TooltipProvider( props: ComponentProps<typeof Provider> ) {
	return <TooltipPrimitive.Provider data-slot="tooltip-provider" { ...props } />;
}

export function Tooltip( { ...props }: ComponentProps<typeof Root> ) {
	return <TooltipPrimitive.Root data-slot="tooltip" { ...props } />;
}

export function TooltipTrigger( { ...props }: ComponentProps<typeof Trigger> ) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" { ...props } />;
}

export function TooltipContent( { className, ...props }: ComponentProps<typeof Popup> ) {
	return (
		<TooltipPrimitive.Popup
			data-slot="tooltip-content"
			className={ cn(
				"z-50 overflow-hidden rounded-base border-2 bg-accent px-3 py-1.5",
				"text-sm font-base text-neutral-dark animate-in fade-in-0 zoom-in-95",
				"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
				"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
				"data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
				"origin-(--radix-tooltip-content-transform-origin)",
				className
			) }
			{ ...props }
		/>
	);
}

export const TooltipPortal = TooltipPrimitive.Portal;
export const TooltipPositioner = TooltipPrimitive.Positioner;

