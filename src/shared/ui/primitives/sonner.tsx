import { Toaster as Sonner } from "sonner";

import type { ComponentProps } from "react";

import { cn } from "@/shared/ui/utils/cn.ts";

export const Toaster = ( { ...props }: ComponentProps<typeof Sonner> ) => {
	return (
		<Sonner
			toastOptions={ {
				unstyled: true,
				classNames: {
					toast: cn(
						"border-2 rounded-lg p-4 flex gap-5 items-center",
						"shadow-sm md:shadow-md uppercase text-sm text-neutral-dark",
						"font-semibold"
					),
					default: "bg-accent",
					error: "bg-apple",
					success: "bg-kiwi"
				}
			} }
			{ ...props }
		/>
	);
};

export { toast } from "sonner";
