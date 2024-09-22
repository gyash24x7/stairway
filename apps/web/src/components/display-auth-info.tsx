import type { UserAuthInfo } from "@auth/api";
import { Avatar, AvatarImage } from "@base/ui";

export const DisplayAuthInfo = ( props: { authInfo?: UserAuthInfo | null } ) => {
	return (
		<div className={ "flex gap-3 items-center" }>
			{ props.authInfo && (
				<Avatar className={ "w-20 h-20 border-2 border-gray-300" }>
					<AvatarImage src={ props.authInfo.avatar } alt=""/>
					<h2>{ props.authInfo.name }</h2>
				</Avatar>
			) }
		</div>
	);
};