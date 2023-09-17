import type { CreateUserInput, LoginInput, User } from "@auth/data";
import { getRequest, postRequest } from "@s2h/client";

export const signUp = ( data: CreateUserInput ): Promise<string> => postRequest( "/auth/signup", data );
export const login = ( data: LoginInput ): Promise<string> => postRequest( "/auth/login", data );
export const me = () => getRequest<User>( "/auth/me" );
export const logout = (): Promise<string> => postRequest( "/auth/logout", {} );
