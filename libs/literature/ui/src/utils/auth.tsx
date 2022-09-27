import React, { createContext, ReactNode, useContext, useState } from "react";
import type { User } from "@prisma/client";
import { useMutation, useQuery } from "react-query";
import { Flex, Spinner } from "@s2h/ui";

const SERVER_URL = "http://localhost:8000";
const GOOGLE_CLIENT_ID = "920568500477-5rrmek91r0pskp7b23emvvt3nqdnp8ls.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URL = "http://localhost:8000/api/auth/callback/google";

export interface IAuthContext {
    user?: User;
    login: VoidFunction;
    logout: VoidFunction;
}

const AuthContext = createContext<IAuthContext>( null! );

export function AuthProvider( props: { children: ReactNode } ) {
    const [ user, setUser ] = useState<User>();

    const login = () => {
        window.location.href = getGoogleAuthUrl();
    };

    const { mutateAsync } = useMutation(
        "logout",
        () => fetch( `${ SERVER_URL }/api/auth/logout`, { method: "delete", credentials: "include" } )
            .then( res => res.json() ),
        { onSuccess: () => setUser( undefined ) }
    );

    const logout = () => mutateAsync();

    const { isLoading } = useQuery(
        "me",
        () => fetch( `${ SERVER_URL }/api/me`, { credentials: "include" } ).then( res => res.json() ).catch(),
        { onSuccess: ( data: User ) => setUser( data ) }
    );

    if ( isLoading ) {
        return (
            <Flex align = { "center" } justify = { "center" } className = { "h-screen w-screen" }>
                <Spinner size = { "2xl" } appearance = { "primary" } />
            </Flex>
        );
    }

    return (
        <AuthContext.Provider value = { { user, login, logout } }>
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