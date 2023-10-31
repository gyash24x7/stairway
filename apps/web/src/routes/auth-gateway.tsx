import { AuthLayout, useAuth } from "@auth/ui";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "../components";

export interface AuthGatewayProps {
	isPrivate?: boolean;
	children: ReactNode;
	footer?: ReactNode;
	footerContent?: ReactNode;
}

export function AuthGateway( { isPrivate, children, footerContent, footer }: AuthGatewayProps ) {
	const { isLoggedIn } = useAuth();

	if ( isPrivate && !isLoggedIn ) {
		return <Navigate to={ "/auth/login" }/>;
	}

	if ( !isPrivate && isLoggedIn ) {
		return <Navigate to={ "/" }/>;
	}

	return isPrivate
		? <AppLayout footerContent={ footerContent } footer={ footer }>{ children }</AppLayout>
		: <AuthLayout>{ children }</AuthLayout>;
}