import { cn } from "@/utils/cn";
import { Close, Content, Description, Overlay, Portal, Root, Title, Trigger } from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef, type HTMLAttributes } from "react";

export const Dialog = Root;

export const DialogTrigger = Trigger;

export const DialogPortal = Portal;

export const DialogClose = Close;

export const DialogOverlay = forwardRef<ComponentRef<typeof Overlay>, ComponentPropsWithoutRef<typeof Overlay>>(
	( { className, ...props }, ref ) => (
		<Overlay
			ref={ ref }
			className={ cn(
				"fixed inset-0 z-50 bg-overlay  data-[state=open]:animate-in",
				"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
				className
			) }
			{ ...props }
		/>
	)
);

export const DialogContent = forwardRef<ComponentRef<typeof Content>, ComponentPropsWithoutRef<typeof Content>>(
	( { className, children, ...props }, ref ) => (
		<DialogPortal>
			<DialogOverlay/>
			<Content
				ref={ ref }
				className={ cn(
					"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%]",
					"translate-y-[-50%] gap-4 rounded-base border-2 border-border bg-bg p-6 shadow-shadow",
					"duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					"data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
					"data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
					className
				) }
				{ ...props }
			>
				{ children }
				<Close
					className={ cn(
						"absolute right-4 top-4 rounded-xs opacity-100 ring-offset-white",
						"focus:outline-hidden focus:ring-2 focus:ring-black focus:ring-offset-2",
						"disabled:pointer-events-none data-[state=open]:bg-white data-[state=open]:text-white"
					) }
				>
					<Cross2Icon className="h-4 w-4"/>
					<span className="sr-only">Close</span>
				</Close>
			</Content>
		</DialogPortal>
	)
);

export const DialogHeader = ( { className, ...props }: HTMLAttributes<HTMLDivElement> ) => (
	<div className={ cn( "flex flex-col space-y-1.5 text-center sm:text-left", className ) } { ...props }/>
);

export const DialogFooter = ( { className, ...props }: HTMLAttributes<HTMLDivElement> ) => (
	<div className={ cn( "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className ) } { ...props } />
);

export const DialogTitle = forwardRef<ComponentRef<typeof Title>, ComponentPropsWithoutRef<typeof Title>>(
	( { className, ...props }, ref ) => (
		<Title
			ref={ ref }
			className={ cn( "text-lg font-heading leading-none tracking-tight", className ) }
			{ ...props }
		/>
	)
);

export const DialogDescription = forwardRef<ComponentRef<typeof Description>, ComponentPropsWithoutRef<typeof Description>>(
	( { className, ...props }, ref ) => (
		<Description
			ref={ ref }
			className={ cn( "text-sm text-text font-base", className ) }
			{ ...props }
		/>
	)
);
