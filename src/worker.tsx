import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

export type AppContext = {};

export default defineApp( [
	setCommonHeaders(),
	( { ctx } ) => {
		// setup ctx here
		ctx;
	},
	render( Document, [ route( "/", Home ) ] )
] );
