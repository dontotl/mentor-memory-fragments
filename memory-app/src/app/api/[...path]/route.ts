import {handleApi} from '@/server/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
async function route(req:Request,context:Context){return handleApi(req,(await context.params).path);}
export {route as GET,route as POST,route as PUT,route as PATCH,route as DELETE};
