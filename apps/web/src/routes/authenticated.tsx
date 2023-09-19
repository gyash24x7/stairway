import { Fragment, ReactNode, useEffect } from "react";
import { useAuth } from "@auth/ui";
import { useNavigate } from "react-router-dom";

export function AuthenticatedPage( props: { children: ReactNode } ) {
	const { isLoggedIn } = useAuth();
	const navigate = useNavigate();

	useEffect( () => {
		if ( !isLoggedIn ) {
			navigate( "/auth/login" );
		}
	}, [ isLoggedIn ] );

	return <Fragment>{ props.children }</Fragment>;
}