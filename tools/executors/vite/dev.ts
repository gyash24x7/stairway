import { exec } from "child_process";

export default function devExecutor( _, context ) {
    console.info( `Executing "vite"...` );

    const projectDir = context.workspace.projects[ context.projectName ].root;

    return new Promise( ( resolve, reject ) => {
        const devProcess = exec(
            `vite --config ${ projectDir }/vite.config.js --port 3000`,
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