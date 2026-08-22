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
					success: "bg-kiwi",
					// `unstyled` means an action renders as a bare browser button
					// unless it is styled here. The update prompt is the most-seen
					// toast with an action, so it would look broken without this.
					actionButton: cn(
						"shrink-0 rounded-lg border-2 border-neutral-dark bg-background",
						"px-3 py-1 text-xs font-semibold text-foreground cursor-pointer"
					)
				}
			} }
			{ ...props }
		/>
	);
};

export { toast } from "sonner";
