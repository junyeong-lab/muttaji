import {createPublicRuntime} from "../lib/public/runtime.js";
// Public routes remain disabled until separately approved server configuration.
const runtime=createPublicRuntime(process.env);
export default {fetch:runtime.url};
