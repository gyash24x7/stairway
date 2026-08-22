import type { PushDevice } from "@/push/shared/schema.ts";

/**
 * The array algebra behind the push-subscription store.
 *
 * Deliberately pure and free of Effect and KV: this is the part with actual
 * behaviour — replace-don't-duplicate, prune, cap — and keeping it out of the
 * storage layer is what makes it testable without a Durable Object or a
 * network.
 */

/** A user may register at most this many devices; the least recently seen go first. */
export const MAX_DEVICES = 10;

/**
 * Adds a device, or refreshes one already registered.
 *
 * The endpoint is the identity: a browser handing back the same endpoint is the
 * same installation, so it replaces rather than accumulating. `createdAt` is
 * carried over from the existing record so "oldest" stays meaningful for
 * capping.
 */
export const upsertDevice = (
	devices: ReadonlyArray<PushDevice>,
	device: PushDevice,
	now: number
) => {
	const existing = devices.find( entry => entry.endpoint === device.endpoint );
	const merged: PushDevice = {
		...device,
		createdAt: existing?.createdAt ?? now,
		lastSeenAt: now
	};

	return capDevices(
		[ ...devices.filter( entry => entry.endpoint !== device.endpoint ), merged ],
		MAX_DEVICES
	);
};

/**
 * Drops endpoints the push service has told us are gone (404/410).
 *
 * Takes a list so a whole send batch prunes in one read-modify-write rather
 * than one per dead device.
 */
export const removeEndpoints = (
	devices: ReadonlyArray<PushDevice>,
	endpoints: ReadonlyArray<string>
) => {
	if ( endpoints.length === 0 ) {
		return devices;
	}

	const gone = new Set( endpoints );
	return devices.filter( device => !gone.has( device.endpoint ) );
};

/** Keeps the `max` most recently seen devices. */
export const capDevices = ( devices: ReadonlyArray<PushDevice>, max: number ) => {
	if ( devices.length <= max ) {
		return devices;
	}

	return [ ...devices ]
		.sort( ( a, b ) => b.lastSeenAt - a.lastSeenAt )
		.slice( 0, max );
};
