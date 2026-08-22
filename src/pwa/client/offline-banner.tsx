"use client";

import { WifiOffIcon } from "lucide-react";

import { useOnlineStatus } from "@/pwa/client/use-online-status.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

/**
 * A corner badge shown while the browser reports no network.
 *
 * `fixed` and `pointer-events-none` on purpose. The couch screen scales a fixed
 * 1920x1080 canvas with a CSS `transform`, so anything inside that subtree gets
 * scaled and mispositioned along with it; staying fixed keeps this readable at
 * any canvas scale and stops it swallowing clicks on the controller.
 *
 * The television is the case that matters most: a frozen board with no
 * explanation is the worst failure this app has, and this turns it into "the TV
 * lost wifi".
 */
export function OfflineBanner() {
	const isOnline = useOnlineStatus();

	if ( isOnline ) {
		return null;
	}

	return (
		<div
			role={ "status" }
			className={ cn(
				"fixed z-50 pointer-events-none select-none",
				"left-1/2 -translate-x-1/2 bottom-[calc(0.75rem+env(safe-area-inset-bottom))]",
				"flex gap-2 items-center rounded-lg border-2 border-outline",
				"bg-apple text-neutral-dark px-3 py-1.5 shadow-md",
				"text-xs font-semibold uppercase tracking-widest"
			) }
		>
			<WifiOffIcon className={ "w-4 h-4" }/>
			<span>Offline</span>
		</div>
	);
}
