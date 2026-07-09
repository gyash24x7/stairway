import { type Theme, type ThemeMode, themeModes, themes } from "./cn";

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "apple";
const DEFAULT_MODE: ThemeMode = "light";

/** Reads the persisted theme/mode from localStorage, falling back to the defaults. */
export function readTheme(): { theme: Theme; mode: ThemeMode } {
	if ( typeof localStorage === "undefined" ) {
		return { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
	}

	const [ theme, mode ] = ( localStorage.getItem( STORAGE_KEY ) ?? "" ).split( "-" );
	return {
		theme: themes.includes( theme as Theme ) ? theme as Theme : DEFAULT_THEME,
		mode: themeModes.includes( mode as ThemeMode ) ? mode as ThemeMode : DEFAULT_MODE
	};
}

/** Persists the theme/mode and applies them as body classes. */
export function applyTheme( theme: Theme, mode: ThemeMode ) {
	localStorage.setItem( STORAGE_KEY, `${ theme }-${ mode }` );
	document.body.classList.remove( ...themes, ...themeModes );
	document.body.classList.add( theme, mode );
}
