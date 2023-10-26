import { Loader } from "@mantine/core";
import { ErrorPage, useAction } from "@s2h/ui";
import { Fragment, ReactNode, useEffect } from "react";
import { initializeAuthStore } from "./store";

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
