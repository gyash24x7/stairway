import { getAuthInfo } from "@/auth/server/functions";
import { Navbar } from "@/shared/components/navbar";
import { Toaster } from "@/shared/primitives/sonner";
import { geistMono } from "@/shared/utils/fonts";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
	title: "Stairway",
	description: "Multiplayer Game Arena"
};

export default async function RootLayout( { children }: Readonly<{ children: ReactNode; }> ) {
	const authInfo = await getAuthInfo();

	return (
		<html lang="en">
		<body className={ `${ geistMono.className } antialiased` }>
		<main className="flex min-h-screen flex-col bg-bg">
			<Navbar authInfo={ authInfo }/>
			<div className={ "px-3 py-3 md:px-5 md:py-5 xl:mt-52 lg:mt-[190px] md:mt-[175px] mt-[140px]" }>
				{ children }
			</div>
			<Toaster expand position={ "top-center" }/>
		</main>
		</body>
		</html>
	);
}
