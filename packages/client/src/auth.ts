import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AuthClient } from "@s2h/auth/router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "./query.tsx";

const link = new RPCLink( {
	url: window.location.origin + "/api/auth",
	fetch: ( request, init ) => fetch( request, { ...init, credentials: "include" } ),
	interceptors: [
		onError( ( error ) => {
			console.error( error );
		} )
	]
} );

const client: AuthClient = createORPCClient( link );
const orpc = createTanstackQueryUtils( client );

export const useUserExistMutation = () => useMutation( orpc.userExists.mutationOptions() );
export const useGetRegistrationOptionsMutation = () => useMutation( orpc.registrationOptions.mutationOptions() );
export const useGetLoginOptionsMutation = () => useMutation( orpc.loginOptions.mutationOptions() );
export const useVerifyRegistrationMutation = () => useMutation( orpc.verifyRegistration.mutationOptions() );
export const useVerifyLoginMutation = () => useMutation( orpc.verifyLogin.mutationOptions() );
export const useLogoutMutation = () => useMutation( orpc.logout.mutationOptions( {
	onSuccess: () => {
		window.location.href = "/";
	}
} ) );

export const ensureAuthInfoQueryData = () => queryClient.ensureQueryData( orpc.authInfo.queryOptions() );
export const useAuthInfoQuery = () => useQuery( orpc.authInfo.queryOptions() );