import { MoonIcon, SunIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/shared/primitives/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger
} from "@/shared/primitives/select";

const themeModes = [ "light", "dark" ] as const;
const themes = [
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

type ThemeMode = typeof themeModes[number];
type Theme = typeof themes[number];

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "apple";
const DEFAULT_MODE: ThemeMode = "light";

/**
 * Reads the persisted theme/mode from localStorage,
 * falling back to the defaults.
 */
function readTheme() {
	if ( typeof localStorage === "undefined" ) {
		return { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
	}

	const [ theme, mode ] = ( localStorage.getItem( STORAGE_KEY ) ?? "" ).split( "-" );
	return {
		theme: themes.includes( theme as Theme ) ? theme as Theme : DEFAULT_THEME,
		mode: themeModes.includes( mode as ThemeMode ) ? mode as ThemeMode : DEFAULT_MODE
	};
}

/**
 * Persists the theme/mode and applies them as body classes.
 */
function applyTheme( theme: Theme, mode: ThemeMode ) {
	localStorage.setItem( STORAGE_KEY, `${ theme }-${ mode }` );
	document.body.classList.remove( ...themes, ...themeModes );
	document.body.classList.add( theme, mode );
}


export function ThemeSwitcher() {
	const [ { theme, mode }, setState ] = useState( () => readTheme() );

	const handleThemeChange = ( nextTheme: Theme, nextMode: ThemeMode ) => {
		applyTheme( nextTheme, nextMode );
		setState( { theme: nextTheme, mode: nextMode } );
	};

	return (
		<Fragment>
			<Select
				onValueChange={ ( t ) => handleThemeChange( ( t as Theme ) ?? "apple", mode ) }
				value={ theme }
			>
				<SelectTrigger/>
				<SelectContent>
					<SelectGroup>
						{ themes.map( ( t ) => (
							<Fragment key={ t }>
								<SelectItem label={ t.toUpperCase() } value={ t }/>
								<SelectSeparator/>
							</Fragment>
						) ) }
					</SelectGroup>
				</SelectContent>
			</Select>
			<Button
				size={ "icon" }
				onClick={ () => handleThemeChange( theme, mode === "light" ? "dark" : "light" ) }
			>
				{ mode === "light"
					? <SunIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					: <MoonIcon className={ "w-4 h-4 md:h-6 md:w-6" }/> }
			</Button>
		</Fragment>
	);
}
