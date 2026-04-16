"use server";

import * as cookie from "cookie";
import { requestInfo } from "rwsdk/worker";

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