import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./utils.tsx";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	( { className, ...props }, ref ) => (
		<div
			ref={ ref }
			className={ cn(
				"rounded-base shadow-shadow border-2 border-border bg-main text-main-foreground",
				className
			) }
			{ ...props }
		/>
	)
);

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	( { className, ...props }, ref ) => (
		<div ref={ ref } className={ cn( "flex flex-col space-y-1.5 p-6", className ) } { ...props }/>
	)
);

export const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
	( { className, ...props }, ref ) => (
		<div
			ref={ ref }
			className={ cn( "font-xl leading-none font-heading tracking-tight", className ) }
			{ ...props }
		/>
	)
);

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
	( { className, ...props }, ref ) => (
		<p ref={ ref } className={ cn( "text-sm text-main-foreground font-base mt-3!", className ) } { ...props } />
	)
);

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	( { className, ...props }, ref ) => (
		<div ref={ ref } className={ cn( "p-6 pt-0", className ) } { ...props } />
	)
);

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	( { className, ...props }, ref ) => (
		<div ref={ ref } className={ cn( "flex items-center p-6 pt-0", className ) } { ...props }/>
	)
);
