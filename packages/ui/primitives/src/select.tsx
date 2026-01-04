import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import { cn } from "./utils.tsx";

const {
	Group,
	Icon,
	Item,
	ItemIndicator,
	ItemText,
	Popup,
	Portal,
	Positioner,
	Root,
	ScrollDownArrow,
	ScrollUpArrow,
	Separator,
	Trigger,
	Value
} = SelectPrimitive;

export const Select = Root;
export const SelectGroup = Group;
export const SelectValue = Value;

export const SelectTrigger = forwardRef<ComponentRef<typeof Trigger>, ComponentPropsWithoutRef<typeof Trigger>>(
	( { className, children, ...props }, ref ) => (
		<Trigger
			className={ cn(
				"flex h-10 items-center justify-between gap-3 rounded-md",
				"border-2 border-black px-3 py-2 text-sm select-none",
				"bg-accent shadow-shadow cursor-pointer text-neutral-dark"
			) }
			ref={ ref }
			{ ...props }
		>
			<Value className={ "uppercase" }/>
			<Icon className="flex">
				<ChevronDownIcon/>
			</Icon>
		</Trigger>
	)
);

export const SelectContent = forwardRef<ComponentRef<typeof Positioner>, ComponentPropsWithoutRef<typeof Positioner>>(
	( { className, children, ...props }, ref ) => (
		<Portal>
			<Positioner className="outline-none select-none z-10" sideOffset={ 8 } ref={ ref } { ...props }>
				<ScrollUpArrow
					className={ cn(
						"top-0 z-1 flex h-4 w-full cursor-default items-center justify-center",
						"rounded-md bg-accent text-center text-xs before:absolute before:-top-full",
						"before:left-0 before:h-full before:w-full before:content-['']",
						"data-[direction=down]:bottom-0 data-[direction=down]:before:-bottom-full"
					) }
				/>
				<Popup
					className={ cn(
						"group max-h-(--available-height) origin-(--transform-origin) overflow-y-auto",
						"rounded-md py-1 text-gray-900 shadow-shadow bg-accent border-black border-2",
						"transition-[transform,scale,opacity] data-ending-style:scale-90",
						"data-ending-style:opacity-0 data-[side=none]:data-ending-style:transition-none",
						"data-starting-style:scale-90 data-starting-style:opacity-0",
						"data-[side=none]:data-starting-style:scale-100",
						"data-[side=none]:data-starting-style:opacity-100",
						"data-[side=none]:data-starting-style:transition-none",
						"dark:shadow-none dark:-outline-offset-1 dark:outline-gray-300"
					) }
				>
					{ children }
				</Popup>
				<ScrollDownArrow
					className={ cn(
						"bottom-0 z-1 flex h-4 w-full cursor-default items-center justify-center",
						"rounded-md bg-[canvas] text-center text-xs before:absolute before:-top-full",
						"before:left-0 before:h-full before:w-full before:content-['']",
						"data-[direction=down]:bottom-0 data-[direction=down]:before:-bottom-full"
					) }
				/>
			</Positioner>
		</Portal>
	)
);

export const SelectItem = forwardRef<ComponentRef<typeof Item>, ComponentPropsWithoutRef<typeof Item>>(
	( { className, children, ...props }, ref ) => (
		<Item
			ref={ ref }
			{ ...props }
			className={ cn(
				"grid min-w-(--anchor-width) cursor-default grid-cols-[1rem_1fr]",
				"items-center gap-3 py-3 pl-2 pr-4 text-sm leading-4 outline-none",
				"select-none group-data-[side=none]:min-w-[calc(var(--anchor-width)+1rem)]",
				"group-data-[side=none]:pr-12 group-data-[side=none]:text-base",
				"group-data-[side=none]:leading-4 data-highlighted:relative",
				"data-highlighted:z-0 data-highlighted:text-foreground",
				"data-highlighted:before:absolute data-highlighted:before:inset-x-1",
				"data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1]",
				"data-highlighted:before:rounded-sm data-highlighted:before:bg-surface",
				"pointer-coarse:py-2.5 pointer-coarse:text-[0.925rem]"
			) }
		>
			<ItemIndicator className="col-start-1">
				<CheckIcon className="size-5"/>
			</ItemIndicator>
			<ItemText className="col-start-2">{ props.label }</ItemText>
		</Item>
	)
);

export const SelectSeparator = forwardRef<ComponentRef<typeof Separator>, ComponentPropsWithoutRef<typeof Separator>>(
	( { className, ...props }, ref ) => (
		<Separator
			ref={ ref }
			className={ cn( "-mx-1 my-1 h-px bg-neutral-dark", className ) }
			{ ...props }
		/>
	)
);
