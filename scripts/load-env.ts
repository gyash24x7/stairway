let envFileContent = "";

Object.keys(Bun.env).map(key => {
	envFileContent += `${key}=${Bun.env[key]}\n`
})

await Bun.write("apps/backend/.env", envFileContent);