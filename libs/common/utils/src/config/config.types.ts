export type AppInfo = {
	id: string;
	name: string;
	host: string;
	port: number;
};

export type AppConfig = {
	appInfo: AppInfo;
	db: {
		url: string;
	};
	auth: {
		audience: string;
		domain: string;
		privateKeyPath: string;
		publicKeyPath: string;
	};
};
