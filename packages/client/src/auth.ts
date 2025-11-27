import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "./orpc";
import { queryClient } from "./query";

export const useUserExistMutation = () => useMutation( orpc.auth.userExists.mutationOptions() );
export const useGetRegistrationOptionsMutation = () => useMutation( orpc.auth.getRegistrationOptions.mutationOptions() );
export const useGetLoginOptionsMutation = () => useMutation( orpc.auth.getLoginOptions.mutationOptions() );
export const useVerifyRegistrationMutation = () => useMutation( orpc.auth.verifyRegistration.mutationOptions() );
export const useVerifyLoginMutation = () => useMutation( orpc.auth.verifyLogin.mutationOptions() );
export const useLogoutMutation = () => useMutation( orpc.auth.logout.mutationOptions( {
	onSuccess: () => {
		window.location.href = "/";
	}
} ) );

export const ensureAuthInfoQueryData = () => queryClient.ensureQueryData( orpc.auth.authInfo.queryOptions() );
export const useAuthInfoQuery = () => useQuery( orpc.auth.authInfo.queryOptions() );