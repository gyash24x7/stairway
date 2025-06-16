import { DisplayAuthInfo } from "@/auth/components/display-auth-info";
import type { AppContext } from "@/worker";

export async function Settings( { ctx }: { ctx: AppContext } ) {
	return (
		<div className={ "flex flex-col items-center" }>
			{ !!ctx.authInfo && <DisplayAuthInfo authInfo={ ctx.authInfo }/> }
		</div>
	);
}