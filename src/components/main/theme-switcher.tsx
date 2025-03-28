"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/base/select";
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

const colors = {
	apple: [ "#ff6b6b", "#fcd7d7" ] as const,
	banana: [ "#ffdc58", "#fef2e8" ] as const,
	orange: [ "#fd9745", "#fff4e0" ] as const,
	blueberry: [ "#88aaee", "#dfe5f2" ] as const,
	kiwi: [ "#a3e636", "#e0e7f1" ] as const,
	grapes: [ "#a388ee", "#e3dff2" ] as const
};

export function ThemeSwitcher() {
	const [ theme, setTheme ] = useLocalStorage<keyof typeof colors>( "color-scheme", "apple" );

	useEffect( () => {
		const root = document.documentElement;
		const [ main, bg ] = colors[ theme ];
		root.style.setProperty( "--main", main );
		root.style.setProperty( "--bg", bg );
	}, [ theme ] );

	return (
		<Select onValueChange={ ( value ) => setTheme( value as keyof typeof colors ) } value={ theme }>
			<SelectTrigger className={ "w-[150px]" }>
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
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}