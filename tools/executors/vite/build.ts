import { exec } from "child_process";

export default async function buildExecutor( _, context ) {
    console.info( `Executing "vite build"...` );

    const projectDir = context.workspace.projects[ context.projectName ].root;

    return new Promise( ( resolve, reject ) => {
        const devProcess = exec(
            `tsc -p ${ projectDir }/tsconfig.app.json && vite build --config ${ projectDir }/vite.config.js`,
            function ( error, stdout, stderr ) {
                if ( error ) {
                    reject( error );
                }
                resolve( { success: !stderr } );
            }
        );

        devProcess.stdout.setEncoding( "utf8" );
        devProcess.stdout.on( "data", console.log );

        devProcess.stderr.setEncoding( "utf8" );
        devProcess.stderr.on( "data", console.error );
    } );
}