import type { SplendorSnapshot } from "@s2h/schema/splendor";
import { createContext, type ReactNode, useContext } from "react";

type SplendorContextValue = {
	data: SplendorSnapshot
};

const SplendorContext = createContext<SplendorContextValue | null>( null );

export function useSplendor() {
	const ctx = useContext( SplendorContext );
	if ( !ctx ) {
		throw new Error( "useSplendor must be used within a SplendorProvider" );
	}
	return ctx;
}

type SplendorProviderProps = {
	data: SplendorSnapshot;
	children: ReactNode;
};

export function SplendorProvider( { data, children }: SplendorProviderProps ) {

	return (
		<SplendorContext value={ { data } }>
			{ children }
		</SplendorContext>
	);
}
