"use strict";
// Browser UMD sources live under a type:module package. Evaluate their existing
// CommonJS branch explicitly, without changing production script semantics.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {createRequire} = require("node:module");
module.exports = function loadBrowserModule(relativePath) {
  const filename = path.resolve(__dirname, relativePath);
  const mod = {exports:{}};
  const run = vm.compileFunction(fs.readFileSync(filename, "utf8"),
    ["module", "exports", "require", "__filename", "__dirname", "globalThis", "document", "window"], {filename});
  run(mod, mod.exports, createRequire(filename), filename, path.dirname(filename), {}, undefined, undefined);
  return mod.exports;
};
