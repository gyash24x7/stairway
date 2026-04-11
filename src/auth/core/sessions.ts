import type { AuthInfo } from "@/auth/core/types";
import { generateSecureRandomString } from "@/shared/utils/generator";
import { useSession } from "@tanstack/react-start/server";

export function useAppSession() {
	return useSession<AuthInfo>( {
		generateId: () => generateSecureRandomString(),
		password: process.env.AUTH_SECRET,
		cookie: {
			maxAge: 7 * 24 * 60 * 60,
			path: "/",
			httpOnly: true,
			secure: process.env[ "NODE_ENV" ] === "production"
		}
	} );
}
