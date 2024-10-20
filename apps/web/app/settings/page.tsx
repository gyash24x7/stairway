import { getAuthInfo, logout } from "@stairway/api/auth";
import { Avatar, AvatarFallback, AvatarImage, Card, CardContent } from "@stairway/components/base";
import { LogoutButton } from "@stairway/components/main";

export default async function SettingsPage() {
	const authInfo = await getAuthInfo();
	return (
		<div className={ "flex flex-col items-center" }>
			{ !!authInfo && (
				<div className="max-w-xl w-full pt-8 relative">
					<Card className={ "bg-muted" }>
						<CardContent className="pt-14 pb-4 px-4 text-center flex flex-col gap-2 items-center">
							<h2 className="text-lg font-semibold text-foreground mb-1">{ authInfo.name }</h2>
							<h2 className="text-md text-foreground mb-1">{ authInfo.email }</h2>
							<LogoutButton logout={ logout }/>
						</CardContent>
					</Card>
					<Avatar
						className="h-20 w-20 absolute top-0 left-1/2 transform -translate-x-1/2 border-4 bg-background">
						<AvatarImage src={ authInfo.avatar } alt={ authInfo.name }/>
						<AvatarFallback>
							{ authInfo.name.split( " " ).map( n => n[ 0 ] ).join( "" ).toUpperCase() }
						</AvatarFallback>
					</Avatar>
				</div>
			) }
		</div>
	);
}