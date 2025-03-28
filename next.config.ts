import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
};

export default nextConfig;

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DATABASE_URL: string;
			BETTER_AUTH_URL: string;
			BETTER_AUTH_SECRET: string;
			GOOGLE_CLIENT_ID: string;
			GOOGLE_CLIENT_SECRET: string;
			GOOGLE_REDIRECT_URI: string;
		}
	}
}