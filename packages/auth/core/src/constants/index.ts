export class Constants {
	public static readonly AUTH_INFO = "authInfo";
	public static readonly IS_WS = "ws";
	public static readonly AUTH_COOKIE = "auth-cookie";
	public static readonly AUTH_TOKEN = "auth-token";
	public static readonly AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/svg?seed=";
}

export class Paths {
	public static readonly BASE = "auth";
	public static readonly TOKEN = "token";
	public static readonly LOGIN = "login";
	public static readonly LOGOUT = "logout";
	public static readonly SIGNUP = "signup";
	public static readonly VERIFY = "verify";
}

export class Messages {
	public static readonly INVALID_CREDENTIALS = "Invalid Credentials!";
	public static readonly USER_NOT_FOUND = "User Not Found!";
	public static readonly USER_NOT_VERIFIED = "User Not Verified!";
	public static readonly USER_ALREADY_EXISTS = "User Already Exists!";
}