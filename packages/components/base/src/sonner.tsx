import { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";
import { cn } from "./cn";

type ToasterProps = ComponentProps<typeof Sonner>

const Toaster = ( { ...props }: ToasterProps ) => {
	return (
		<Sonner
			theme={ "system" }
			className="toaster group"
			toastOptions={ {
				classNames: {
					toast: cn(
						"group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground",
						"group-[.toaster]:border-border group-[.toaster]:shadow-lg"
					),
					description: "group-[.toast]:text-muted-foreground",
					actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
				}
			} }
			{ ...props }
		/>
	);
};

export { Toaster };
