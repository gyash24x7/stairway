"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/primitives/select";
import { cn } from "@/shared/utils/cn";
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

const colors = {
	apple: [ "#ff6b6b", "#fcd7d7" ] as const,
	banana: [ "#ffdc58", "#fef2e8" ] as const,
	orange: [ "#fd9745", "#fff4e0" ] as const,
	blueberry: [ "#0099ff", "#ddeffd" ] as const,
	kiwi: [ "#8ae600", "#e7f7cf" ] as const,
	grapes: [ "#a388ee", "#e3dff2" ] as const,
	mango: [ "#ffbf00", "#fef3c8" ] as const,
	ice: [ "#00c8f0", "#cdf6fe" ] as const,
	strawberry: [ "#fc64ab", "#fce9f3" ] as const
};

export function ThemeSwitcher() {
	const [ theme, setTheme ] = useLocalStorage<keyof typeof colors>( "color-scheme", "apple" );

	useEffect( () => {
		const root = document.documentElement;
		const [ main, bg ] = colors[ theme ];
		root.style.setProperty( "--main", main );
		root.style.setProperty( "--background", bg );
	}, [ theme ] );

	return (
		<Select onValueChange={ ( value ) => setTheme( value as keyof typeof colors ) } value={ theme }>
			<SelectTrigger className={ cn( "w-[150px]", "h-8 md:h-10" ) }>
				<SelectValue placeholder={ "Select Theme" }/>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectItem value={ "apple" }>APPLE</SelectItem>
					<SelectItem value={ "banana" }>BANANA</SelectItem>
					<SelectItem value={ "orange" }>ORANGE</SelectItem>
					<SelectItem value={ "kiwi" }>KIWI</SelectItem>
					<SelectItem value={ "blueberry" }>BLUEBERRY</SelectItem>
					<SelectItem value={ "grapes" }>GRAPES</SelectItem>
					<SelectItem value={ "mango" }>MANGO</SelectItem>
					<SelectItem value={ "ice" }>ICE</SelectItem>
					<SelectItem value={ "strawberry" }>STRAWBERRY</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}