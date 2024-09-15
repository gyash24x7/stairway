import { bungeeSpice, montserrat, Separator } from "@base/ui";
import { DisplayAuthInfo, getAuthInfo, Navbar } from "@main/ui";
import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Stairway",
	description: "Stairway is a multiplayer game arena"
};

export default async function RootLayout( { children }: Readonly<{ children: ReactNode; }> ) {
	const authInfo = await getAuthInfo();
	return (
		<html lang="en">
		<body className={ montserrat.className }>
		<main className="flex min-h-screen flex-col p-10">
			<div className={ "flex justify-between items-center" }>
				<div>
					<p className={ `text-lg md:text-xl font-bold` }>LET'S PLAY!</p>
					<h1 className={ `text-6xl md:text-8xl font-bold ${ bungeeSpice.className }` }>STAIRWAY</h1>
				</div>
				<DisplayAuthInfo authInfo={ authInfo }/>
			</div>
			<Navbar authInfo={ authInfo }/>
			<Separator className={ "mb-10" }/>
			{ children }
		</main>
		</body>
		</html>
	);
}
