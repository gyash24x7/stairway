"use client";

import { LogoutButton } from "@/auth/components/logout-button";
import type { AuthInfo } from "@/auth/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/primitives/avatar";
import { Card, CardContent } from "@/shared/primitives/card";

export function DisplayAuthInfo( { authInfo }: { authInfo: AuthInfo } ) {
	return (
		<div className="max-w-xl w-full pt-8 relative">
			<Card className={ "bg-muted" }>
				<CardContent className="pt-14 pb-4 px-4 text-center flex flex-col gap-2 items-center">
					<h2 className="text-lg font-semibold text-foreground mb-1">{ authInfo.name }</h2>
					<h2 className="text-md text-foreground mb-1">{ authInfo.username }</h2>
					<LogoutButton/>
				</CardContent>
			</Card>
			<Avatar className="h-20 w-20 absolute top-0 left-1/2 transform -translate-x-1/2 border-4 bg-bg">
				<AvatarImage src={ authInfo.avatar } alt={ authInfo.name }/>
				<AvatarFallback>
					{ authInfo.name.split( " " ).map( ( n: string ) => n[ 0 ] ).join( "" ).toUpperCase() }
				</AvatarFallback>
			</Avatar>
		</div>
	);
}