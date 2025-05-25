import { cn } from "@/shared/utils/cn";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	( { className, type, ...props }, ref ) => {
		return (
			<input
				type={ type }
				className={ cn(
					"flex h-10 w-full rounded-base border-2 border-border px-3 py-2",
					"text-main-foreground font-base file:border-0 file:bg-transparent file:text-sm",
					"file:font-base placeholder:text-muted-foreground bg-secondary-background text-sm",
					"focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black",
					"focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
					"selection:bg-main selection:text-main-foreground",
					className
				) }
				ref={ ref }
				{ ...props }
			/>
		);
	}
);
