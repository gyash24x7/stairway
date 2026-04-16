import { Document } from "@/document";
import { setCommonHeaders } from "@/headers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

export type AppContext = {};

export default defineApp( [
	setCommonHeaders(),
	render( Document, [ route( "/", () => <div>Hello, World!</div> ) ] )
] );
