import { cn } from "@/shared/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export const buttonVariants = cva(
	cn(
		"inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm cursor-pointer",
		"ring-offset-white transition-all gap-2 focus-visible:outline-hidden focus-visible:ring-2",
		"focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
		"font-base font-[500]"
	),
	{
		variants: {
			variant: {
				default: cn(
					"text-main-foreground bg-main border-2 border-border shadow-shadow",
					"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
				),
				noShadow: "text-main-foreground bg-main border-2 border-border",
				neutral: cn(
					"bg-secondary-background text-main-foreground border-border shadow-shadow",
					"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
				),
				reverse: cn(
					"text-main-foreground bg-main border-2 border-border hover:shadow-shadow",
					"hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY"
				)
			},
			size: {
				default: "md:h-10 px-4 py-2 h-8",
				sm: "h-8 px-3",
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

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	( { className, variant, size, ...props }, ref ) => {
		return <button className={ cn( buttonVariants( { variant, size, className } ) ) } ref={ ref } { ...props }/>;
	}
);
