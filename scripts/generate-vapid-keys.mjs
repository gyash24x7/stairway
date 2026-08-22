/**
 * Generates a VAPID keypair for web push.
 *
 * Run once: `bun run vapid`.
 *
 * The keypair identifies this application server to every push service, and a
 * subscription is bound to the public key it was created with — so ROTATING
 * THESE INVALIDATES EVERY SUBSCRIPTION ALREADY STORED. Generate once, keep the
 * private half secret, and treat replacing it as a migration rather than a
 * routine credential rotation.
 *
 * Uses the sender's own library to mint them, so the encoding is guaranteed to
 * be the one it will later expect.
 */

import { generateVAPIDKeys } from "web-push-neo";

const { publicKey, privateKey } = await generateVAPIDKeys();

console.log( "Add these to .env, and set them as Worker secrets when deploying:\n" );
console.log( "VAPID_SUBJECT=mailto:you@example.com" );
console.log( `VAPID_PUBLIC_KEY=${ publicKey }` );
console.log( `VAPID_PRIVATE_KEY=${ privateKey }` );
console.log( "\nVAPID_PUBLIC_KEY is injected into the client bundle by alchemy.run.ts;" );
console.log( "the browser and the service worker both need it to subscribe." );
console.log( "\nWith these unset, notifications are simply off — every game still works." );
