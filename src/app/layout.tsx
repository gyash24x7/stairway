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
			<div className={ "px-3 md:px-5 lg:mt-52 xl:mt-56 md:mt-48 mt-44" }>
				{ children }
			</div>
			<Toaster expand/>
		</main>
		</body>
		</html>
	);
}
