"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

export type RequireSessionProps = {
	children: ReactNode;
	/**
	 * Replaces the default "Please log in to play." — the couch screen wants
	 * TV-sized copy, and it asks the viewer to sign in rather than to play.
	 */
	fallback?: ReactNode;
};

/**
 * Gates its children on a valid session. Note this is *session*, not membership:
 * whether the viewer holds a seat is the server's call (`assertMember`), and the
 * couch screen deliberately does not need one.
 */
export function RequireSession( { children, fallback }: RequireSessionProps ) {
	const { authInfo, isLoading } = useAuth();

	if ( isLoading ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	if ( !authInfo ) {
		return fallback ?? (
			<div className={ "text-lg text-center mt-8" }>Please log in to play.</div>
		);
	}

	return children;
}
