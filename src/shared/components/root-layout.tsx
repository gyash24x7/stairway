import { Navbar } from "@/shared/components/navbar";
import type { LayoutProps } from "rwsdk/router";

export async function RootLayout( { children, requestInfo }: LayoutProps ) {
	return (
		<main className="flex min-h-screen flex-col bg-bg">
			<Navbar authInfo={ requestInfo?.ctx.authInfo }/>
			<div className={ "px-3 py-3 md:px-5 md:py-5 xl:mt-52 lg:mt-[190px] md:mt-[175px] mt-[140px]" }>
				{ children }
			</div>
			{/*<Toaster expand position={ "top-center" }/>*/ }
		</main>
	);
}