import { getAuthInfo } from "@main/ui";
import { redirect } from "next/navigation";
import { Fragment, ReactNode } from "react";

export default async function LiteratureLayout( props: { children: ReactNode } ) {
	const authInfo = await getAuthInfo();

	if ( !authInfo ) {
		return redirect( "/" );
	}

	return <Fragment>{ props.children }</Fragment>;
}