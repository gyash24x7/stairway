import { Document } from "@/document";
import { setCommonHeaders } from "@/headers";
import { AppLayout } from "@/shared/components/layout";
import type { Theme, ThemeMode } from "@/shared/utils/cn";
import * as cookie from "cookie";
import { layout, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

export type AppContext = {
	theme: Theme;
	themeMode: ThemeMode;
};

export default defineApp( [
	setCommonHeaders(),

	function loadTheme( { ctx, request } ) {
		const cookieHeader = request.headers.get( "Cookie" ) ?? "";
		const { theme = "apple-light" } = cookie.parseCookie( cookieHeader );
		ctx.theme = theme.split( "-" )[ 0 ] as Theme;
		ctx.themeMode = theme.split( "-" )[ 1 ] as ThemeMode;
	},

	render( Document, [
		layout( AppLayout, [
			route( "/", () => <div>Hello, World!</div> )
		] )
	] )
] );
