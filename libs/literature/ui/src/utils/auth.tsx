import { useMutation } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useState } from "react";
import { IUser } from "@s2h/utils";
import { useLoaderData } from "react-router-dom";

const SERVER_URL = "http://localhost:8000";
const GOOGLE_CLIENT_ID = "920568500477-5rrmek91r0pskp7b23emvvt3nqdnp8ls.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URL = "http://localhost:8000/api/auth/callback/google";

export interface IAuthContext {
	user?: IUser;
	login: VoidFunction;
	logout: VoidFunction;
	isLoggedIn: boolean;
}

const AuthContext = createContext<IAuthContext>( null! );

export function AuthProvider( props: { children: ReactNode } ) {
	const user = useLoaderData() as IUser | undefined;
	const [ isLoggedIn, setIsLoggedIn ] = useState( !!user );

	const login = () => {
		window.location.href = getGoogleAuthUrl();
	};

	const { mutateAsync } = useMutation( {
		onSuccess: () => setIsLoggedIn( false ),
		mutationFn: () => fetch( `${ SERVER_URL }/api/auth/logout`, { method: "delete", credentials: "include" } )
			.then( res => res.json() )
	} );

	const logout = () => mutateAsync();

	return (
		<AuthContext.Provider value={ { user, login, logout, isLoggedIn } }>
			{ props.children }
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext( AuthContext );

function getGoogleAuthUrl() {
	const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

	const options = {
		redirect_uri: GOOGLE_REDIRECT_URL,
		client_id: GOOGLE_CLIENT_ID,
		access_type: "offline",
		response_type: "code",
		prompt: "consent",
		scope: [
			"https://www.googleapis.com/auth/userinfo.profile",
			"https://www.googleapis.com/auth/userinfo.email"
		].join( " " )
	};

	const params = new URLSearchParams( options );

	return `${ rootUrl }?${ params.toString() }`;
}