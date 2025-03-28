import { cn } from "@/utils/cn";
import { geistMono } from "@/utils/fonts";
import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

export const Toaster = ( { ...props }: ComponentProps<typeof Sonner> ) => {
	return (
		<Sonner
			toastOptions={ {
				unstyled: true,
				classNames: {
					toast: cn(
						"bg-main border-2 rounded-lg p-4 flex gap-5 items-center",
						"shadow-shadow uppercase text-sm",
						geistMono.className
					)
				}
			} }
			{ ...props }
		/>
	);
};
