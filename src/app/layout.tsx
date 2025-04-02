import { Toaster } from "@/components/base/sonner";
import { Navbar } from "@/components/main/navbar";
import { getAuthInfo } from "@/server/utils/auth";
import { geistMono } from "@/utils/fonts";
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
