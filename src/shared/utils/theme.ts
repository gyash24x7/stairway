"use server";

import type { Theme, ThemeMode } from "@/shared/utils/cn";
import * as cookie from "cookie";
import { requestInfo } from "rwsdk/worker";

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