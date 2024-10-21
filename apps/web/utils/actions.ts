"use server";

import { auth } from "@/utils/auth.ts";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function getAuthInfo() {
	const data = await auth.api.getSession( { headers: headers() } );
	if ( !!data ) {
		return { id: data.user.id, email: data.user.email, name: data.user.name, avatar: data.user.image ?? "" };
	}

	return null;
}

export async function logout() {
	await auth.api.signOut( { headers: headers() } );
	revalidatePath( "/" );
}
