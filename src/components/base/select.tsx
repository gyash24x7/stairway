import { cn } from "@/utils/cn";
import {
	Content,
	Group,
	Icon,
	Item,
	ItemIndicator,
	ItemText,
	Label,
	Portal,
	Root,
	ScrollDownButton,
	ScrollUpButton,
	Separator,
	Trigger,
	Value,
	Viewport
} from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";

export const Select = Root;
export const SelectGroup = Group;
export const SelectValue = Value;

export const SelectTrigger = forwardRef<ComponentRef<typeof Trigger>, ComponentPropsWithoutRef<typeof Trigger>>(
	( { className, children, ...props }, ref ) => (
		<Trigger
			ref={ ref }
			className={ cn(
				"flex h-10 w-full items-center text-mtext bg-main justify-between rounded-base",
				"border-2 border-border px-3 py-2 text-sm font-base ring-offset-white",
				"placeholder:text-mtext placeholder:opacity-50 focus:outline-hidden focus:ring-2",
				"focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				"[&>span]:line-clamp-1 cursor-pointer",
				className
			) }
			{ ...props }
		>
			{ children }
			<Icon asChild>
				<ChevronDown className={ "h-4 w-4" }/>
			</Icon>
		</Trigger>
	)
);

export const SelectScrollUpButton = forwardRef<
	ComponentRef<typeof ScrollUpButton>,
	ComponentPropsWithoutRef<typeof ScrollUpButton>
>( ( { className, ...props }, ref ) => (
	<ScrollUpButton
		ref={ ref }
		className={ cn(
			"flex cursor-default text-mtext items-center justify-center py-1 font-base",
			className
		) }
		{ ...props }
	>
		<ChevronUp className={ "h-4 w-4" }/>
	</ScrollUpButton>
) );

export const SelectScrollDownButton = forwardRef<
	ComponentRef<typeof ScrollDownButton>,
	ComponentPropsWithoutRef<typeof ScrollDownButton>
>( ( { className, ...props }, ref ) => (
	<ScrollDownButton
		ref={ ref }
		className={ cn(
			"flex cursor-default text-mtext items-center justify-center py-1 font-base",
			className
		) }
		{ ...props }
	>
		<ChevronDown className={ "h-4 w-4" }/>
	</ScrollDownButton>
) );

export const SelectContent = forwardRef<ComponentRef<typeof Content>, ComponentPropsWithoutRef<typeof Content>>(
	( { className, children, position = "popper", ...props }, ref ) => (
		<Portal>
			<Content
				ref={ ref }
				className={ cn(
					"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-base border-2",
					"border-border bg-main font-base text-mtext data-[state=open]:animate-in",
					"data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
					"data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
					"data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
					"data-[side=top]:slide-in-from-bottom-2",
					position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1",
					position === "popper" && "data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
					className
				) }
				position={ position }
				{ ...props }
			>
				<SelectScrollUpButton/>
				<Viewport
					className={ cn(
						"p-1",
						position === "popper" && "h-[var(--radix-select-trigger-height)]",
						position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
					) }
				>
					{ children }
				</Viewport>
			</Content>
		</Portal>
	)
);

export const SelectLabel = forwardRef<ComponentRef<typeof Label>, ComponentPropsWithoutRef<typeof Label>>(
	( { className, ...props }, ref ) => (
		<Label
			ref={ ref }
			className={ cn(
				"border-2 border-transparent py-1.5 pl-8 pr-2 text-sm font-base text-mtext/80",
				className
			) }
			{ ...props }
		/>
	)
);

export const SelectItem = forwardRef<ComponentRef<typeof Item>, ComponentPropsWithoutRef<typeof Item>>(
	( { className, children, ...props }, ref ) => (
		<Item
			ref={ ref }
			className={ cn(
				"relative flex w-full text-mtext select-none items-center cursor-pointer",
				"rounded-base border-2 border-transparent py-1.5 pl-8 pr-2 text-sm font-base",
				"outline-none focus:border-border data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				className
			) }
			{ ...props }
		>
			<span className={ "absolute left-2 flex h-3.5 w-3.5 items-center justify-center" }>
				<ItemIndicator>
					<Check className={ "h-4 w-4" }/>
				</ItemIndicator>
			</span>
			<ItemText>{ children }</ItemText>
		</Item>
	)
);

export const SelectSeparator = forwardRef<ComponentRef<typeof Separator>, ComponentPropsWithoutRef<typeof Separator>>(
	( { className, ...props }, ref ) => (
		<Separator
			ref={ ref }
			className={ cn( "-mx-1 my-1 h-px bg-border", className ) }
			{ ...props }
		/>
	)
);