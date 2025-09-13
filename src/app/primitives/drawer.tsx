import { cn } from "@/utils/cn";
import {
	type ComponentProps,
	type ComponentPropsWithoutRef,
	type ComponentRef,
	forwardRef,
	type HTMLAttributes
} from "react";
import { Drawer as DrawerPrimitive } from "vaul";

const { Trigger, Portal, Close, Overlay, Content, Title, Description, Root } = DrawerPrimitive;

export const Drawer = ( { shouldScaleBackground = true, ...props }: ComponentProps<typeof Root> ) => (
	<Root shouldScaleBackground={ shouldScaleBackground } { ...props }/>
);

export const DrawerTrigger = Trigger;

export const DrawerPortal = Portal;

export const DrawerClose = Close;

export const DrawerOverlay = forwardRef<ComponentRef<typeof Overlay>, ComponentPropsWithoutRef<typeof Overlay>>(
	( { className, ...props }, ref ) => (
		<Overlay
			ref={ ref }
			className={ cn( "fixed inset-0 z-50 bg-overlay", className ) }
			{ ...props }
		/>
	)
);

export const DrawerContent = forwardRef<ComponentRef<typeof Content>, ComponentPropsWithoutRef<typeof Content>>(
	( { className, children, ...props }, ref ) => (
		<DrawerPortal>
			<DrawerOverlay/>
			<Content
				ref={ ref }
				className={ cn(
					"fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-base",
					"border-2 border-border bg-background font-heading",
					className
				) }
				{ ...props }
			>
				<div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-blank"/>
				{ children }
			</Content>
		</DrawerPortal>
	)
);

export const DrawerHeader = ( { className, ...props }: HTMLAttributes<HTMLDivElement> ) => (
	<div className={ cn( "grid gap-1.5 p-4 text-center sm:text-left", className ) } { ...props } />
);

export const DrawerFooter = ( { className, ...props }: HTMLAttributes<HTMLDivElement> ) => (
	<div className={ cn( "mt-auto flex flex-col gap-2 py-4 px-3 md:px-4 font-heading", className ) } { ...props } />
);

export const DrawerTitle = forwardRef<ComponentRef<typeof Title>, ComponentPropsWithoutRef<typeof Title>>(
	( { className, ...props }, ref ) => (
		<Title
			ref={ ref }
			className={ cn( "text-lg font-semibold leading-none tracking-tight", className ) }
			{ ...props }
		/>
	)
);

export const DrawerDescription = forwardRef<ComponentRef<typeof Description>, ComponentPropsWithoutRef<typeof Description>>(
	( { className, ...props }, ref ) => (
		<Description
			ref={ ref }
			className={ cn( "text-sm font-base text-main-foreground", className ) }
			{ ...props }
		/>
	)
);

