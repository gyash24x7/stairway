"use client";

import { DownloadIcon, PlusSquareIcon, ShareIcon } from "lucide-react";

import { useInstall } from "@/pwa/client/use-install.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@/shared/ui/primitives/drawer.tsx";

/**
 * Offers to install the app, or explains how to on the one platform that will
 * not do it for you.
 *
 * Renders nothing once installed — an install button inside the installed app
 * is nonsense — and nothing on a browser that neither fires the prompt nor is
 * iOS, which covers desktop Firefox and every in-app webview.
 *
 * Note this only ever appears where the navbar does, so the couch/TV screens
 * never show it. That is deliberate: a television across the room is not the
 * device anyone installs on. The controller keeps the app chrome, so the phone
 * — the device that actually benefits — does get it.
 */
export function InstallButton() {
	const { canPrompt, isStandalone, isIos, install } = useInstall();

	if ( isStandalone ) {
		return null;
	}

	if ( canPrompt ) {
		return (
			<Button
				size={ "icon" }
				variant={ "neutral" }
				aria-label={ "Install Stairway" }
				onClick={ () => void install() }
			>
				<DownloadIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
			</Button>
		);
	}

	if ( !isIos ) {
		return null;
	}

	// iOS fires no `beforeinstallprompt` and exposes no install API, so the only
	// honest affordance is a walkthrough of Safari's own menu.
	return (
		<Drawer>
			<DrawerTrigger asChild>
				<Button size={ "icon" } variant={ "neutral" } aria-label={ "Install Stairway" }>
					<DownloadIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
				</Button>
			</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>INSTALL STAIRWAY</DrawerTitle>
					<DrawerDescription>
						Add Stairway to your home screen for a full-screen app — and to
						turn on turn notifications, which iOS only allows once installed.
					</DrawerDescription>
				</DrawerHeader>

				<div className={ "flex flex-col gap-4 px-4 pb-2" }>
					<div className={ "flex gap-3 items-center" }>
						<ShareIcon className={ "w-6 h-6 shrink-0" }/>
						<p className={ "text-sm" }>
							Tap the <span className={ "font-heading" }>Share</span> button in
							Safari&apos;s toolbar.
						</p>
					</div>
					<div className={ "flex gap-3 items-center" }>
						<PlusSquareIcon className={ "w-6 h-6 shrink-0" }/>
						<p className={ "text-sm" }>
							Choose <span className={ "font-heading" }>Add to Home Screen</span>,
							then tap <span className={ "font-heading" }>Add</span>.
						</p>
					</div>
				</div>

				<DrawerFooter>
					<DrawerClose asChild>
						<Button variant={ "neutral" }>GOT IT</Button>
					</DrawerClose>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
