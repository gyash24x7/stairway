const { composePlugins, withNx } = require( "@nx/rspack" );

module.exports = composePlugins( withNx(), ( config ) => {
	config.externals = [
		function ( obj, callback ) {
			const resource = obj.request;
			const lazyImports = [
				"@nestjs/core",
				"@nestjs/microservices",
				"@nestjs/platform-express",
				"cache-manager",
				"class-validator",
				"class-transformer",
				// ADD THIS
				"@nestjs/microservices/microservices-module",
				"@nestjs/websockets",
				"socket.io-adapter",
				"utf-8-validate",
				"bufferutil",
				"kerberos",
				"gcp-metadata",
				"mongodb",
				"@mongodb-js/zstd",
				"snappy",
				"@aws-sdk/credential-providers",
				"mongodb-client-encryption",
				"@nestjs/websockets/socket-module",
				"bson-ext",
				"snappy/package.json",
				"aws4",
				"socks"
			];
			if ( !lazyImports.includes( resource ) ) {
				return callback();
			}
			try {
				require.resolve( resource );
			} catch ( err ) {
				callback( null, resource );
			}
			callback();
		}
	];
	return config;
} );