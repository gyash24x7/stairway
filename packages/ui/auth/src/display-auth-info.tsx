import { Avatar, AvatarFallback, AvatarImage } from "@s2h-ui/primitives/avatar";
import { Card, CardContent } from "@s2h-ui/primitives/card";
import { Drawer, DrawerContent, DrawerTrigger } from "@s2h-ui/primitives/drawer";
import { useState } from "react";
import { useAuth } from "./context.tsx";
import { LogoutButton } from "./logout-button.tsx";

export function DisplayAuthInfo() {
	const { authInfo } = useAuth();
	const [ open, setOpen ] = useState( false );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger>
				<Avatar className="h-10 w-10 bg-bg cursor-pointer">
					<AvatarImage src={ authInfo?.avatar } alt={ authInfo?.name } className={ "bg-main" }/>
					<AvatarFallback>
						{ authInfo?.name.split( " " ).map( ( n: string ) => n[ 0 ] ).join( "" ).toUpperCase() }
					</AvatarFallback>
				</Avatar>
			</DrawerTrigger>
			<DrawerContent>
				<div className="p-8 relative flex justify-center">
					<Card className={ "bg-muted w-full max-w-xl" }>
						<CardContent className="pt-14 pb-4 px-4 text-center flex flex-col gap-2 items-center">
							<h2 className="text-lg font-semibold text-foreground mb-1">{ authInfo?.name }</h2>
							<h2 className="text-md text-foreground mb-1">{ authInfo?.username }</h2>
							<LogoutButton/>
						</CardContent>
					</Card>
					<Avatar className="h-20 w-20 absolute top-0 left-1/2 transform -translate-x-1/2 border-4 bg-bg">
						<AvatarImage src={ authInfo?.avatar } alt={ authInfo?.name }/>
						<AvatarFallback>
							{ authInfo?.name.split( " " ).map( ( n: string ) => n[ 0 ] ).join( "" ).toUpperCase() }
						</AvatarFallback>
					</Avatar>
				</div>
			</DrawerContent>
		</Drawer>
	);
}