import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type { ComponentProps } from "react";
import { cn } from "./utils.tsx";

const { Root, Thumb } = SwitchPrimitive;

export function Switch( { className, ...props }: ComponentProps<typeof Root> ) {
	return (
		<Root
			data-slot="switch"
			className={ cn(
				"peer inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full",
				"border-2 border-black bg-background transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				"focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				"data-[state=checked]:bg-accent data-[state=unchecked]:bg-background",
				"data-[state=checked]:text-neutral-dark",
				className
			) }
			{ ...props }
		>
			<Thumb
				data-slot="switch-thumb"
				className={ cn(
					"pointer-events-none block h-4 w-4 rounded-full bg-background border-2 border-black ring-0",
					"transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1"
				) }
			/>
		</Root>
	);
}
