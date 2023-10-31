import { useIsLoggedIn } from "@auth/ui";
import type { ReactNode } from "react";
import { Fragment } from "react";
import { Navigate } from "react-router-dom";

export interface AuthGatewayProps {
	isPrivate?: boolean;
	children: ReactNode;
}

export function AuthGateway( { isPrivate, children }: AuthGatewayProps ) {
	const isLoggedIn = useIsLoggedIn();

	if ( isPrivate && !isLoggedIn ) {
		return <Navigate to={ "/auth/login" }/>;
	}

	if ( !isPrivate && isLoggedIn ) {
		return <Navigate to={ "/" }/>;
	}

	return <Fragment>{ children }</Fragment>;
}