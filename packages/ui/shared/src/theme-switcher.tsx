import { Button } from "@s2h-ui/primitives/button";
import { MoonIcon, SunIcon } from "@s2h-ui/primitives/icons";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from "@s2h-ui/primitives/select";
import { Toggle } from "@s2h-ui/primitives/toggle";
import { cn } from "@s2h-ui/primitives/utils";
import { Fragment, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

const colors = {
	APPLE: [ "#ff6b6b", "#fcd7d7", "#3A1F1F" ] as const,
	BANANA: [ "#ffdc58", "#fef2e8", "#3A3116" ] as const,
	ORANGE: [ "#fd9745", "#fff4e0", "#3A2414" ] as const,
	BLUEBERRY: [ "#0099ff", "#ddeffd", "#152A3D" ] as const,
	KIWI: [ "#00bd84", "#e7f7cf", "#1E3A2E" ] as const,
	GRAPES: [ "#a388ee", "#e3dff2", "#2F2A46" ] as const,
	MANGO: [ "#ffbf00", "#fef3c8", "#35280E" ] as const,
	ICE: [ "#00c8f0", "#cdf6fe", "#122E36" ] as const,
	STRAWBERRY: [ "#fc64ab", "#fce9f3", "#361A29" ] as const
};

export function ThemeSwitcher() {
	const [ theme, setTheme ] = useLocalStorage<keyof typeof colors>( "theme", "APPLE" );
	const [ themeMode, setThemeMode ] = useLocalStorage<"light" | "dark">( "themeMode", "light" );

	useEffect( () => {
		const root = document.documentElement;
		const [ main, lightBg, darkBg ] = colors[ theme ];
		root.style.setProperty( "--main", main );
		root.style.setProperty( "--background", themeMode === "light" ? lightBg : darkBg );
		root.style.setProperty( "--border", themeMode === "light" ? darkBg : lightBg );
		root.style.setProperty( "--main-foreground", themeMode === "light" ? darkBg : lightBg );
		root.style.setProperty( "--secondary-background", themeMode === "light" ? "#eee" : "#111" );
	}, [ theme, themeMode ] );

	return (
		<Fragment>
			<Select onValueChange={ ( value ) => setTheme( value as keyof typeof colors ) } value={ theme }>
				<SelectTrigger className={ cn( "w-37.5", "h-8 md:h-10" ) }>
					<SelectValue/>
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{ Object.keys( colors ).map( ( color ) => (
							<Fragment key={ color }>
								<SelectItem label={ color } value={ color }/>
								<SelectSeparator/>
							</Fragment>
						) ) }
					</SelectGroup>
				</SelectContent>
			</Select>
			<Toggle
				render={ () => (
					<Button onClick={ () => setThemeMode( themeMode === "light" ? "dark" : "light" ) }>
						{ themeMode === "light" ? <SunIcon/> : <MoonIcon/> }
					</Button>
				) }
			/>
		</Fragment>
	);
}