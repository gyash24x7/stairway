"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

export type RequireSessionProps = {
	children: ReactNode;
	fallback?: ReactNode;
};

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
