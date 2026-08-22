import { themeModes, themes } from "@/shared/ui/utils/cn.ts";

import type { Theme, ThemeMode } from "@/shared/ui/utils/cn.ts";

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "apple";
const DEFAULT_MODE: ThemeMode = "light";

/**
 * Reads the persisted theme/mode from localStorage,
 * falling back to the defaults.
 */
export function readTheme() {
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
 * Points `<meta name="theme-color">` at whatever the current palette resolves
 * `--background` to, so an installed app's status bar and title bar continue the
 * navbar rather than cutting against it.
 *
 * Reads back from the CSSOM instead of keeping a table of hexes here: there are
 * ten palettes in two modes, and the same lookup would have to be duplicated in
 * the inline bootstrap in `index.html` (plain script, cannot import). That is
 * forty hand-copied values guaranteed to drift from `styles.css`. Resolved
 * custom properties already have `var()` substituted, so this reads a literal
 * colour with no parsing.
 *
 * `--background` and not `--surface`: the element touching the top edge is the
 * fixed navbar, which is `bg-background`. `--surface` scrolls underneath it.
 */
export function syncThemeColor() {
	const meta = document.querySelector( "meta[name=\"theme-color\"]" );
	if ( !meta ) {
		return;
	}

	const colour = getComputedStyle( document.body )
		.getPropertyValue( "--background" )
		.trim();

	if ( colour ) {
		meta.setAttribute( "content", colour );
	}
}

/**
 * Persists the theme/mode and applies them as body classes.
 */
export function applyTheme( theme: Theme, mode: ThemeMode ) {
	localStorage.setItem( STORAGE_KEY, `${ theme }-${ mode }` );
	document.body.classList.remove( ...themes, ...themeModes );
	document.body.classList.add( theme, mode );

	// Last, so the classes above are already resolved when the colour is read.
	syncThemeColor();
}
