import { useMutation } from "@tanstack/react-query";
import { login, logout, signUp } from "./base";
import type { OpOps } from "@s2h/client";
import type { CreateUserInput, LoginInput } from "@auth/data";

export const useSignUpMutation = ( ops?: OpOps<string> ) => useMutation( {
	mutationFn: ( data: CreateUserInput ) => signUp( data ),
	...ops
} );

export const useLoginMutation = ( ops?: OpOps<string> ) => useMutation( {
	mutationFn: ( data: LoginInput ) => login( data ),
	...ops
} );

export const useLogoutMutation = ( ops?: OpOps<string> ) => useMutation( {
	mutationFn: () => logout(),
	...ops
} );
