"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

export type RequireSessionProps = {
	children: ReactNode;
	fallback?: ReactNode;
};

export function RequireSession( { children, fallback }: RequireSessionProps ) {
	const { authInfo, isLoading, isError, error, refetch } = useAuth();

	if ( isLoading ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	// Before the signed-out branch, never after: a request that failed says
	// nothing about whether there is a session. Telling an offline player to log
	// in would send them into a passkey ceremony that cannot complete without
	// the network. `errorMessage` already renders transport failures as
	// "Couldn't reach the server", so this needs no copy of its own.
	if ( isError ) {
		return (
			<ErrorState
				title={ "Can't reach the server" }
				error={ error }
				onRetry={ () => void refetch() }
			/>
		);
	}

	if ( !authInfo ) {
		return fallback ?? (
			<div className={ "text-lg text-center mt-8" }>Please log in to play.</div>
		);
	}

	return children;
}
