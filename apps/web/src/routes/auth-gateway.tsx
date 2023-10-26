import { useAuthStore } from "@auth/ui";
import type { ReactNode } from "react";
import { Fragment, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export interface AuthGatewayProps {
	isPrivate?: boolean;
	children: ReactNode;
}

export function AuthGateway( { isPrivate, children }: AuthGatewayProps ) {
	const isLoggedIn = useAuthStore( ( state ) => state.isLoggedIn );
	const navigate = useNavigate();

	useEffect( () => {
		if ( isPrivate && !isLoggedIn ) {
			navigate( "/auth/login" );
		} else if ( !isPrivate && isLoggedIn ) {
			navigate( "/" );
		}
	}, [ isLoggedIn, isPrivate ] );

	return <Fragment>{ children }</Fragment>;
}