import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge class names using clsx and tailwind-merge.
 *
 * @param inputs - Class names to be merged.
 * @returns A single string of merged class names.
 */
export function cn( ...inputs: ClassValue[] ) {
	return twMerge( clsx( inputs ) );
}

export const themeModes = [ "light", "dark" ] as const;
export const themes = [
	"apple",
	"orange",
	"mango",
	"banana",
	"olive",
	"kiwi",
	"ice",
	"blueberry",
	"grape",
	"strawberry"
] as const;

export type ThemeMode = typeof themeModes[number];
export type Theme = typeof themes[number];
