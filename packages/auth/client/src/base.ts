import type { CreateUserInput, LoginInput, UserAuthInfo } from "@auth/data";
import type { ApiResponse } from "@s2h/client";
import { getRequest, postRequest } from "@s2h/client";

export const signUp = ( data: CreateUserInput ): Promise<ApiResponse> => postRequest( "/auth/signup", data );
export const login = ( data: LoginInput ): Promise<ApiResponse> => postRequest( "/auth/login", data );
export const me = () => getRequest<UserAuthInfo>( "/auth/me" );
export const logout = (): Promise<ApiResponse> => postRequest( "/auth/logout", {} );
