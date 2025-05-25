"use server";

import type { AuthInfo } from "@/auth/types";

export async function getAuthInfo(): Promise<AuthInfo | undefined> {
	return { id: "1234", name: "John Doe", email: "", avatar: "" };
}