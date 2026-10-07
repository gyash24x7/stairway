import { Fragment } from "react";

import { Login } from "@/auth/ui/login";
import { useAuth } from "@/auth/ui/use-auth";
import { RUser } from "@/auth/ui/user";

export function AuthControl() {
	const user = useAuth();
	return <Fragment>{ !user ? <Login/> : <RUser user={ user }/> }</Fragment>;
}
