import { createAuthClient } from "better-auth/react";
import { baseUrl } from "./query.client";

const client = createAuthClient( { baseURL: baseUrl } );

export const useSession = client.useSession;

export const login = () => client.signIn.social( { provider: "google", callbackURL: window.location.href } );

export const logout = () => client.signOut();