import type { PrismaClient } from "@prisma/client";
import type { ExpressMiddleware } from "@s2h/utils";

export default function ( prisma: PrismaClient ): ExpressMiddleware {
    return async function ( _req, res, next ) {
        if ( !res.locals[ "userId" ] ) {
            return res.sendStatus( 403 );
        } else {
            const user = await prisma.user.findUnique( { where: { id: res.locals[ "userId" ] } } );
            if ( !user ) {
                return res.sendStatus( 403 );
            }
            res.locals[ "user" ] = user;
            return next();
        }
    };
}