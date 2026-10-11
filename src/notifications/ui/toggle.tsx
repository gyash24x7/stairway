import { BellIcon, BellOffIcon } from "lucide-react";

import { usePush } from "@/notifications/ui/use-push";
import { Button } from "@/shared/primitives/button";
import { toast } from "@/shared/primitives/sonner";
import { Spinner } from "@/shared/primitives/spinner";


/** What to say instead of a toggle, for each way a device cannot have one. */
const blocked = {
	unsupported: "This browser can't show notifications.",
	"needs-install": "Add Stairway to your Home Screen to get notifications.",
	denied: "Notifications are blocked. Allow them in your browser's settings.",
	unavailable: undefined,
	loading: undefined
} as const;

/**
 * Turns this device's notifications on or off — your turn, a seat filling, a
 * game ending, a rematch. Lives in the player's own dialog, beside logout,
 * because it is a setting of this device under this account.
 */
export function NotificationsToggle() {
	const { status, busy, enable, disable } = usePush();

	if ( status === "unavailable" ) {
		return null;
	}

	if ( status !== "on" && status !== "off" && status !== "loading" ) {
		return <p className={ "text-sm text-muted-foreground" }>{ blocked[ status ] }</p>;
	}

	const handleClick = async () => {
		if ( status === "on" ) {
			await disable();
			return;
		}
		const enabled = await enable();
		if ( enabled ) {
			toast.success( "We'll let you know when it's your turn." );
		}
	};

	return (
		<Button
			className={ "flex gap-2 items-center" }
			onClick={ handleClick }
			disabled={ busy || status === "loading" }
		>
			{ busy ? <Spinner/> : status === "on" ? (
				<>NOTIFICATIONS ON <BellIcon className={ "w-4 h-4" }/></>
			) : (
				<>NOTIFICATIONS OFF <BellOffIcon className={ "w-4 h-4" }/></>
			) }
		</Button>
	);
}

/**
 * The same switch, offered at the table: a bell beside the invite button while
 * this device is not signed up. A table is where the reason to want it is in
 * front of the player — they are about to wait on somebody else — so this is
 * where the question is asked. It disappears once answered either way, since a
 * player who said no has the toggle in their own dialog if they change their mind.
 */
export function NotifyMeButton( props: { className?: string } ) {
	const { status, busy, enable } = usePush();

	if ( status !== "off" ) {
		return null;
	}

	const handleClick = async () => {
		const enabled = await enable();
		if ( enabled ) {
			toast.success( "We'll let you know when it's your turn." );
		}
	};

	return (
		<Button
			onClick={ handleClick }
			size={ "icon" }
			disabled={ busy }
			title={ "Notify me when it's my turn" }
			className={ props.className }
		>
			{ busy ? <Spinner/> : <BellIcon className={ "w-4 h-4 md:h-6 md:w-6" }/> }
		</Button>
	);
}
