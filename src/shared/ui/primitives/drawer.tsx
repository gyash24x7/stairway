"use client";

import type { ComponentProps } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/shared/ui/utils/cn.ts";

const { Root, Trigger, Portal, Description, Close, Title, Overlay, Content } = DrawerPrimitive;

export function Drawer( { ...props }: ComponentProps<typeof Root> ) {
	return <Root data-slot="drawer" { ...props } />;
}

export function DrawerTrigger( { ...props }: ComponentProps<typeof Trigger> ) {
	return <Trigger data-slot="drawer-trigger" { ...props } />;
}

export function DrawerPortal( { ...props }: ComponentProps<typeof Portal> ) {
	return <Portal data-slot="drawer-portal" { ...props } />;
}

export function DrawerClose( { ...props }: ComponentProps<typeof Close> ) {
	return <Close data-slot="drawer-close" { ...props } />;
}

export function DrawerOverlay( { className, ...props }: ComponentProps<typeof Overlay> ) {
	return (
		<Overlay
			data-slot="drawer-overlay"
			className={ cn(
				"fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
				"data-open:animate-in data-open:fade-in-0 data-closed:animate-out",
				"data-closed:fade-out-0",
				className
			) }
			{ ...props }
		/>
	);
}

export function DrawerContent( {
	className,
	children,
	...props
}: ComponentProps<typeof Content> ) {
	return (
		<DrawerPortal data-slot="drawer-portal">
			<DrawerOverlay/>
			<Content
				data-slot="drawer-content"
				className={ cn(
					"group/drawer-content fixed z-50 flex h-auto flex-col items-center bg-background",
					"text-sm text-foreground data-[vaul-drawer-direction=bottom]:inset-x-0",
					"data-[vaul-drawer-direction=bottom]:bottom-0",
					"data-[vaul-drawer-direction=bottom]:mt-24",
					"data-[vaul-drawer-direction=bottom]:max-h-[80vh]",
					"data-[vaul-drawer-direction=bottom]:rounded-t-xl",
					"data-[vaul-drawer-direction=bottom]:border-t",
					"data-[vaul-drawer-direction=left]:inset-y-0",
					"data-[vaul-drawer-direction=left]:left-0",
					"data-[vaul-drawer-direction=left]:w-3/4",
					"data-[vaul-drawer-direction=left]:rounded-r-xl",
					"data-[vaul-drawer-direction=left]:border-r",
					"data-[vaul-drawer-direction=right]:inset-y-0",
					"data-[vaul-drawer-direction=right]:right-0",
					"data-[vaul-drawer-direction=right]:w-3/4",
					"data-[vaul-drawer-direction=right]:rounded-l-xl",
					"data-[vaul-drawer-direction=right]:border-l",
					"data-[vaul-drawer-direction=top]:inset-x-0",
					"data-[vaul-drawer-direction=top]:top-0",
					"data-[vaul-drawer-direction=top]:mb-24",
					"data-[vaul-drawer-direction=top]:max-h-[80vh]",
					"data-[vaul-drawer-direction=top]:rounded-b-xl",
					"data-[vaul-drawer-direction=top]:border-b",
					"data-[vaul-drawer-direction=left]:sm:max-w-sm",
					"data-[vaul-drawer-direction=right]:sm:max-w-sm",
					className
				) }
				{ ...props }
			>
				<div
					className={ cn(
						"mx-auto mt-4 hidden h-1 w-25 shrink-0 rounded-full bg-accent",
						"group-data-[vaul-drawer-direction=bottom]/drawer-content:block"
					) }
				/>
				<div className={ "max-w-xl w-full" }>
					{ children }
				</div>
			</Content>
		</DrawerPortal>
	);
}

export function DrawerHeader( { className, ...props }: ComponentProps<"div"> ) {
	return (
		<div
			data-slot="drawer-header"
			className={ cn(
				"flex flex-col gap-0.5 p-4 md:gap-0.5 md:text-left",
				"group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center",
				"group-data-[vaul-drawer-direction=top]/drawer-content:text-center",
				className
			) }
			{ ...props }
		/>
	);
}

export function DrawerFooter( { className, ...props }: ComponentProps<"div"> ) {
	return (
		<div
			data-slot="drawer-footer"
			className={ cn( "mt-auto flex flex-col gap-2 p-4", className ) }
			{ ...props }
		/>
	);
}

export function DrawerTitle( { className, ...props }: ComponentProps<typeof Title> ) {
	return (
		<Title
			data-slot="drawer-title"
			className={ cn(
				"font-heading text-lg text-left font-medium text-foreground",
				className
			) }
			{ ...props }
		/>
	);
}

export function DrawerDescription( { className, ...props }: ComponentProps<typeof Description> ) {
	return (
		<Description
			data-slot="drawer-description"
			className={ cn( "text-sm text-left text-muted-foreground", className ) }
			{ ...props }
		/>
	);
}
