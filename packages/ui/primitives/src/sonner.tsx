import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";
import { cn } from "./utils.tsx";

export const Toaster = ( { ...props }: ComponentProps<typeof Sonner> ) => {
	return (
		<Sonner
			toastOptions={ {
				unstyled: true,
				classNames: {
					toast: cn(
						"bg-main border-2 rounded-lg p-4 flex gap-5 items-center",
						"shadow-shadow uppercase text-sm",
						"font-base font-[500]"
					)
				}
			} }
			{ ...props }
		/>
	);
};

export { toast } from "sonner";