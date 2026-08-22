"use client";

import { BellIcon, BellOffIcon } from "lucide-react";

import { usePush } from "@/push/client/use-push.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";

/**
 * The turn-notification switch, and the several honest ways it can be
 * unavailable.
 *
 * Each unavailable case says *why*, because the alternatives are worse: a
 * hidden control leaves someone hunting for a feature they were told about, and
 * a button that silently does nothing — the usual treatment of a denied
 * permission — reads as a broken app.
 */
export function NotificationsToggle() {
	const {
		supported,
		permission,
		subscribed,
		deviceCount,
		isBusy,
		needsInstall,
		enable,
		disable
	} = usePush();

	if ( !supported ) {
		return (
			<p className={ "text-xs text-muted-foreground" }>
				This browser can&apos;t do turn notifications.
			</p>
		);
	}

	// iOS exposes no push at all until the site is on the Home Screen, so there
	// is nothing to offer here yet — only somewhere else to point.
	if ( needsInstall ) {
		return (
			<p className={ "text-xs text-muted-foreground" }>
				Install Stairway to your home screen to turn on notifications.
			</p>
		);
	}

	if ( permission === "denied" ) {
		return (
			<p className={ "text-xs text-muted-foreground" }>
				Notifications are blocked. Re-enable them in your browser settings for
				this site.
			</p>
		);
	}

	return (
		<div className={ "flex gap-3 items-center" }>
			<Button
				size={ "sm" }
				variant={ subscribed ? "neutral" : "default" }
				disabled={ isBusy }
				onClick={ () => void ( subscribed ? disable() : enable() ) }
			>
				{ subscribed
					? <BellOffIcon className={ "w-4 h-4 mr-2" }/>
					: <BellIcon className={ "w-4 h-4 mr-2" }/> }
				{ subscribed ? "TURN OFF" : "NOTIFY MY TURN" }
			</Button>
			{ subscribed && deviceCount > 0 && (
				<span className={ "text-xs text-muted-foreground" }>
					{ deviceCount === 1 ? "1 device" : `${ deviceCount } devices` }
				</span>
			) }
		</div>
	);
}
