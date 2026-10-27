import {createPublicRuntime} from "../lib/public/runtime.js";
const runtime=createPublicRuntime(process.env);
export default {fetch:runtime.session};
