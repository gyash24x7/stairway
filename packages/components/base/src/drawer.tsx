import { ComponentProps, ComponentPropsWithoutRef, ElementRef, forwardRef, HTMLAttributes } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "./cn.ts";

const { Trigger, Portal, Close, Overlay, Content, Title, Description, Root } = DrawerPrimitive;

const Drawer = ( { shouldScaleBackground = true, ...props }: ComponentProps<typeof Root> ) => (
	<Root shouldScaleBackground={ shouldScaleBackground } { ...props }/>
);

Drawer.displayName = "Drawer";

const DrawerTrigger = Trigger;

const DrawerPortal = Portal;

const DrawerClose = Close;

const DrawerOverlay = forwardRef<ElementRef<typeof Overlay>, ComponentPropsWithoutRef<typeof Overlay>>(
	( { className, ...props }, ref ) => (
		<Overlay
			ref={ ref }
			className={ cn( "fixed inset-0 z-50 bg-black/80", className ) }
			{ ...props }
		/>
	)
);

DrawerOverlay.displayName = Overlay.displayName;

const DrawerContent = forwardRef<ElementRef<typeof Content>, ComponentPropsWithoutRef<typeof Content>>(
	( { className, children, ...props }, ref ) => (
		<DrawerPortal>
			<DrawerOverlay/>
			<Content
				ref={ ref }
				className={ cn(
					"fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
					className
				) }
				{ ...props }
			>
				<div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted"/>
				{ children }
			</Content>
		</DrawerPortal>
	)
);

DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ( { className, ...props }: HTMLAttributes<HTMLDivElement> ) => (
	<div className={ cn( "grid gap-1.5 p-4 text-center sm:text-left", className ) } { ...props } />
);

DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ( { className, ...props }: HTMLAttributes<HTMLDivElement> ) => (
	<div className={ cn( "mt-auto flex flex-col gap-2 p-4", className ) } { ...props } />
);

DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = forwardRef<ElementRef<typeof Title>, ComponentPropsWithoutRef<typeof Title>>(
	( { className, ...props }, ref ) => (
		<Title
			ref={ ref }
			className={ cn( "text-lg font-semibold leading-none tracking-tight", className ) }
			{ ...props }
		/>
	)
);

DrawerTitle.displayName = Title.displayName;

const DrawerDescription = forwardRef<ElementRef<typeof Description>, ComponentPropsWithoutRef<typeof Description>>(
	( { className, ...props }, ref ) => (
		<Description
			ref={ ref }
			className={ cn( "text-sm text-muted-foreground", className ) }
			{ ...props }
		/>
	)
);

DrawerDescription.displayName = Description.displayName;

export {
	Drawer,
	DrawerPortal,
	DrawerOverlay,
	DrawerTrigger,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
	DrawerDescription
};
