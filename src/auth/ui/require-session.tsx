import { useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import type { ReactNode } from "react";

import { fetchMeAtom } from "@/auth/ui/client";
import { Spinner } from "@/shared/primitives/spinner";

export type RequireSessionProps = {
	children: ReactNode;
	fallback?: ReactNode;
	loading?: ReactNode;
};

export function RequireSession( { children, fallback, loading }: RequireSessionProps ) {
	const result = useAtomValue( fetchMeAtom );

	if ( result.waiting ) {
		return loading ?? <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	if ( AsyncResult.isFailure( result ) ) {
		return (
			<div className={ "text-lg text-center mt-8" }>
				{ "Something went wrong!" }
			</div>
		);
	}

	if ( !AsyncResult.isSuccess( result ) || result.value === null ) {
		return fallback ?? (
			<div className={ "text-lg text-center mt-8" }>Please log in to play.</div>
		);
	}

	return children;
}
