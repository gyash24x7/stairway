/** Whether this page is already running as the installed app. */
export const isStandalone = () => typeof window !== "undefined" && (
	window.matchMedia( "(display-mode: standalone)" ).matches
	|| ( navigator as Navigator & { standalone?: boolean } ).standalone === true
);

/**
 * iOS and iPadOS: no install event at all, and no web push until the app has
 * been added to the home screen. iPadOS reports itself as a Mac, so a Mac with
 * a touch screen is taken to be an iPad.
 */
export const isIos = () => typeof navigator !== "undefined" && (
	/iphone|ipad|ipod/i.test( navigator.userAgent )
	|| ( navigator.userAgent.includes( "Macintosh" ) && navigator.maxTouchPoints > 1 )
);
