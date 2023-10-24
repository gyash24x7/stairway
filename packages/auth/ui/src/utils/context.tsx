import { Fragment, ReactNode, useEffect } from "react";
import { Loader } from "@mantine/core";
import { initializeAuthStore } from "./store";
import { ErrorPage, useAction } from "@s2h/ui";

export function AuthStoreProvider( props: { children: ReactNode } ) {
	const { execute, error, isLoading } = useAction( initializeAuthStore );

	useEffect( () => {
		execute( undefined ).then();
	}, [] );

	if ( error ) {
		return <ErrorPage/>;
	}

	if ( isLoading ) {
		return <Loader/>;
	}

	return <Fragment>{ props.children }</Fragment>;
}
