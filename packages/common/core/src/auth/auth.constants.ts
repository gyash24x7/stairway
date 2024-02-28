import type { CookieOptions } from "express";

export class Constants {
	public static readonly AUTH_USER_ID = "authUserId";
	public static readonly AUTH_USER = "authUser";
	public static readonly AUTH_COOKIE = "auth-cookie";
	public static readonly REFRESH_COOKIE = "refresh-cookie";
	public static readonly AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/svg?seed=";
	public static readonly GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
	public static readonly GOOGLE_GET_USER_URL = "https://www.googleapis.com/oauth2/v1/userinfo";
}

export class TokenType {
	public static readonly ACCESS_TOKEN = "access";
	public static readonly REFRESH_TOKEN = "refresh";
}

export class Paths {
	public static readonly AUTH = "auth";
	public static readonly GET_AUTH_USER = "";
	public static readonly LOGOUT = "logout";
	public static readonly AUTH_CALLBACK = "callback";
}

export class Messages {
	public static readonly UNAUTHORIZED = "Unauthorized!";
	public static readonly EMAIL_NOT_VERIFIED = "Email Not Verified!";
}

export const accessTokenCookieOptions: CookieOptions = {
	maxAge: 9000000,
	httpOnly: true,
	domain: "localhost",
	path: "/",
	sameSite: "lax",
	secure: false
};

export const refreshTokenCookieOptions: CookieOptions = {
	...accessTokenCookieOptions,
	maxAge: 3.154e10 // 1 year
};