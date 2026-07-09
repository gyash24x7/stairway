import { cn } from "@s2h/shared/utils/cn";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";

const { Fallback, Image, Root } = AvatarPrimitive;

export const Avatar = forwardRef<ComponentRef<typeof Root>, ComponentPropsWithoutRef<typeof Root>>(
	( { className, ...props }, ref ) => (
		<Root
			ref={ ref }
			className={ cn(
				"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
				"border border-inverted-surface bg-surface",
				className
			) }
			{ ...props }
		/>
	)
);

export const AvatarImage = forwardRef<
	ComponentRef<typeof Image>,
	ComponentPropsWithoutRef<typeof Image>
>(
	( { className, ...props }, ref ) => (
		<Image
			ref={ ref }
			className={ cn( "aspect-square h-full w-full", className ) } { ...props }
		/>
	)
);

export const AvatarFallback = forwardRef<
	ComponentRef<typeof Fallback>,
	ComponentPropsWithoutRef<typeof Fallback>
>(
	( { className, ...props }, ref ) => (
		<Fallback
			ref={ ref }
			className={ cn(
				"flex h-full w-full items-center justify-center rounded-full",
				"bg-background text-neutral-dark font-base",
				className
			) }
			{ ...props }
		/>
	)
);
