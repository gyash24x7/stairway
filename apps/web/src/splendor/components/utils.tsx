import type { Gem } from "@s2h/splendor-core/types";

export const gemColors: Record<Gem, string> = {
	diamond: "bg-gray-100 text-gray-600",
	onyx: "bg-gray-800 text-gray-200",
	ruby: "bg-apple",
	sapphire: "bg-blueberry",
	emerald: "bg-kiwi",
	gold: "bg-mango"
};

export const gemLightColors: Record<Gem, string> = {
	diamond: "bg-gray-100 text-gray-600",
	onyx: "bg-neutral-dark text-gray-200",
	ruby: "bg-surface-apple text-apple",
	sapphire: "bg-surface-blueberry text-blueberry",
	emerald: "bg-surface-kiwi text-kiwi",
	gold: "bg-surface-mango text-mango"
};