import { passkeyClient } from "@better-auth/passkey/client";
import { AuthInfo, type RegisterInput } from "@s2h/schema/auth";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient( {
	baseURL: import.meta.env[ "VITE_API_URL" ],
	basePath: "/api/auth",
	fetchOptions: { credentials: "include" },
	plugins: [ passkeyClient() ]
} );

export const fetchMeFn = async () => {
	const { data } = await authClient.getSession();
	if ( !data?.user ) {
		return null;
	}

	return AuthInfo.make( {
		id: data.user.id,
		name: data.user.name,
		avatar: data.user.image ?? ""
	} );
};

export const loginPasskeyFn = async (): Promise<void> => {
	const { error } = await authClient.signIn.passkey();
	if ( error ) {
		throw new Error( error.message ?? "Passkey sign-in failed." );
	}
};

export const registerPasskeyFn = async ( input: RegisterInput ): Promise<void> => {
	const { error } = await authClient.passkey.addPasskey( {
		name: input.email,
		context: JSON.stringify( input )
	} );

	if ( error ) {
		throw new Error( error.message ?? "Passkey registration failed." );
	}

	await loginPasskeyFn();
};

export const logoutFn = async (): Promise<void> => {
	await authClient.signOut();
};
