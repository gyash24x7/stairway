import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent, Spinner } from "@base/components";
import { ExitIcon } from "@radix-ui/react-icons";
import { logout } from "@stairway/clients/auth";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useTransition } from "react";

export const Route = createFileRoute( "/settings" )( {
	component: () => {
		const { authInfo } = Route.useRouteContext();

		const [ isPending, startTransition ] = useTransition();

		const handleLogout = () => startTransition(
			async () => {
				await logout();
				window.location.href = "/";
			}
		);

		return (
			<div className={ "flex flex-col items-center" }>
				{ !!authInfo && (
					<div className="max-w-xl w-full pt-8 relative">
						<Card className={ "bg-muted" }>
							<CardContent className="pt-14 pb-4 px-4 text-center flex flex-col gap-2 items-center">
								<h2 className="text-lg font-semibold text-foreground mb-1">{ authInfo.name }</h2>
								<h2 className="text-md text-foreground mb-1">{ authInfo.email }</h2>
								<Button
									variant={ "ghost" }
									className={ "text-red-600 flex gap-2 items-center" }
									onClick={ handleLogout }
								>
									{ isPending ? <Spinner/> : (
										<Fragment>
											<Fragment>LOGOUT</Fragment>
											<ExitIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
										</Fragment>
									) }
								</Button>
							</CardContent>
						</Card>
						<Avatar
							className="h-20 w-20 absolute top-0 left-1/2 transform -translate-x-1/2 border-4 bg-background">
							<AvatarImage src={ authInfo.avatar } alt={ authInfo.name }/>
							<AvatarFallback>
								{ authInfo.name.split( " " ).map( ( n: string ) => n[ 0 ] ).join( "" ).toUpperCase() }
							</AvatarFallback>
						</Avatar>
					</div>
				) }
			</div>
		);
	}
} );
