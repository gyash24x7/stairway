import { useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { fetchMeAtom } from "@/auth/ui/client";

export function useAuth() {
	return useAtomValue(
		fetchMeAtom,
		result => AsyncResult.isSuccess( result ) ? result.value : null
	);
}
