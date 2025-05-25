import { cn } from "@/shared/utils/cn";
import { forwardRef, type HTMLAttributes } from "react";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
	( { className, ...props }, ref ) => (
		<div className="relative w-full rounded-md">
			<table
				ref={ ref }
				className={ cn( "w-full caption-bottom border-border border-2 text-sm rounded-md", className ) }
				{ ...props }
			/>
		</div>
	)
);

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
	( { className, ...props }, ref ) => (
		<thead ref={ ref } className={ cn( "[&_tr]:border-b", className ) } { ...props } />
	)
);

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
	( { className, ...props }, ref ) => (
		<tbody
			ref={ ref }
			className={ cn( "[&_tr:last-child]:border-0", className ) }
			{ ...props }
		/>
	)
);

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
	( { className, ...props }, ref ) => (
		<tfoot
			ref={ ref }
			className={ cn( "border-t border-t-border bg-main font-base [&>tr]:last:border-b-0", className ) }
			{ ...props }
		/>
	)
);

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
	( { className, ...props }, ref ) => (
		<tr
			ref={ ref }
			className={ cn(
				"border-b border-border text-main-foreground transition-colors bg-main font-base",
				"hover:bg-main data-[state=selected]:bg-secondary-background data-[state=selected]:text-main-foreground",
				className
			) }
			{ ...props }
		/>
	)
);

export const TableHead = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
	( { className, ...props }, ref ) => (
		<th
			ref={ ref }
			className={ cn(
				"h-12 px-4 text-left align-middle font-heading text-main-foreground [&:has([role=checkbox])]:pr-0",
				className
			) }
			{ ...props }
		/>
	)
);

export const TableCell = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
	( { className, ...props }, ref ) => (
		<td
			ref={ ref }
			className={ cn(
				"p-2 align-middle font-base [&:has([role=checkbox])]:pr-0",
				className
			) }
			{ ...props }
		/>
	)
);

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
	( { className, ...props }, ref ) => (
		<caption
			ref={ ref }
			className={ cn( "mt-4 text-sm text-main-foreground font-base", className ) }
			{ ...props }
		/>
	)
);
