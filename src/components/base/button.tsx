import { cn } from "@/utils/cn";
import { geistMono } from "@/utils/fonts";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

const buttonVariants = cva(
	cn(
		"inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm cursor-pointer",
		"ring-offset-white transition-all gap-2 focus-visible:outline-hidden focus-visible:ring-2",
		"focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
		geistMono.className
	),
	{
		variants: {
			variant: {
				default: cn(
					"text-mtext bg-main border-2 border-border shadow-shadow",
					"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
				),
				noShadow: "text-mtext bg-main border-2 border-border",
				neutral: cn(
					"bg-bw text-text border-border shadow-shadow",
					"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
				),
				reverse: cn(
					"text-mtext bg-main border-2 border-border hover:shadow-shadow",
					"hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY"
				)
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 px-3",
				lg: "h-11 rounded-md px-8",
				icon: "h-10 w-10"
			}
		},
		defaultVariants: {
			variant: "default",
			size: "default"
		}
	}
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	( { className, variant, size, asChild = false, ...props }, ref ) => {
		const Comp = asChild ? Slot : "button";
		return <Comp className={ cn( buttonVariants( { variant, size, className } ) ) } ref={ ref } { ...props }/>;
	}
);
