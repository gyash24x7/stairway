"use server";

import type { Theme, ThemeMode } from "@/shared/utils/cn";
import * as cookie from "cookie";
import { requestInfo } from "rwsdk/worker";

/**
 * Server action that sets the theme cookie for the user.
 * Persists the selected theme and mode as a cookie with a one-year expiration.
 * @param theme - The theme name to apply.
 * @param themeMode - The theme mode (e.g. light or dark).
 */
export async function updateTheme( theme: Theme, themeMode: ThemeMode ) {
	requestInfo.response.headers.set(
		"Set-Cookie",
		cookie.serialize( {
			name: "theme",
			value: `${ theme }-${ themeMode }`,
			sameSite: "lax",
			path: "/",
			maxAge: 31536000
		} )
	);
}
