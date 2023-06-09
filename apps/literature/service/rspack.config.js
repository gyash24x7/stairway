const { composePlugins, withNx } = require( "@nx/rspack" );

function externalsFn( obj, callback ) {
	const resource = obj.request;
	const lazyImports = [
		"@nestjs/core",
		"@nestjs/microservices",
		"@nestjs/platform-express",
		"cache-manager",
		"class-validator",
		"class-transformer",
		"@nestjs/microservices/microservices-module",
		"@nestjs/websockets",
		"socket.io-adapter",
		"utf-8-validate",
		"bufferutil",
		"kerberos",
		"@mongodb-js/zstd",
		"snappy",
		"@aws-sdk/credential-providers",
		"mongodb-client-encryption",
		"@nestjs/websockets/socket-module",
		"bson-ext",
		"snappy/package.json",
		"aws4",
		"nats",
		"kafkajs",
		"mqtt",
		"ioredis",
		"amqp-connection-manager",
		"amqplib"
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

module.exports = composePlugins( withNx(), ( config ) => {
	return {
		...config,
		externalsType: "commonjs",
		externals: [ externalsFn ],
		target: "node"
	};
} );