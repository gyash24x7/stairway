import { Button } from "@s2h-ui/primitives/button";
import { MoonIcon, SunIcon } from "@s2h-ui/primitives/icons";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger
} from "@s2h-ui/primitives/select";
import { cn } from "@s2h-ui/primitives/utils";
import { Fragment, type ReactNode, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

const themeModes = [ "light", "dark" ] as const;
const themes = [
	"apple",
	"orange",
	"mango",
	"banana",
	"lime",
	"kiwi",
	"ice",
	"blueberry",
	"grape",
	"strawberry"
] as const;

type ThemeMode = "light" | "dark";
type Theme = typeof themes[number];

export function ThemeLoader( props: { children: ReactNode } ) {
	const [ theme ] = useLocalStorage<Theme>( "theme", "apple" );
	const [ themeMode ] = useLocalStorage<ThemeMode>( "themeMode", "light" );

	useEffect( () => {
		document.body.classList.remove( ...themes );
		document.body.classList.remove( ...themeModes );
		document.body.classList.add( theme, themeMode );
	}, [ theme, themeMode ] );

	return <Fragment>{ props.children }</Fragment>;
}

export function ThemeSwitcher() {
	const [ theme, setTheme ] = useLocalStorage<Theme>( "theme", "apple" );
	const [ themeMode, setThemeMode ] = useLocalStorage<ThemeMode>( "themeMode", "light" );
	return (
		<Fragment>
			<Select onValueChange={ ( value ) => value && setTheme( value ) } value={ theme }>
				<SelectTrigger className={ cn( "w-37.5", "h-8 md:h-10" ) }/>
				<SelectContent>
					<SelectGroup>
						{ themes.map( ( theme ) => (
							<Fragment key={ theme }>
								<SelectItem label={ theme.toUpperCase() } value={ theme }/>
								<SelectSeparator/>
							</Fragment>
						) ) }
					</SelectGroup>
				</SelectContent>
			</Select>
			<Button onClick={ () => setThemeMode( themeMode === "light" ? "dark" : "light" ) }>
				{ themeMode === "light" ? <SunIcon/> : <MoonIcon/> }
			</Button>
		</Fragment>
	);
}