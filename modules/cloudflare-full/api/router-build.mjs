import { readFile } from "node:fs/promises";
import path from "node:path";

function replaceOnce(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`find-my-way ${label} replacement expected once, found ${count}`);
  return source.replace(needle, replacement);
}

export function transformFindMyWaySource(source, id = "find-my-way") {
  id = id.replaceAll("\\", "/");
  let out = source;
  if (id.endsWith("lib/node.js")) out = replaceOnce(out, `    const lines = []\n    for (let i = 1; i < this.prefix.length; i++) {\n      const charCode = this.prefix.charCodeAt(i)\n      lines.push(\`path.charCodeAt(i + \${i}) === \${charCode}\`)\n    }\n    this.matchPrefix = new Function('path', 'i', \`return \${lines.join(' && ')}\`) // eslint-disable-line`, `    this.matchPrefix = (path, i) => {\n      for (let offset = 1; offset < this.prefix.length; offset++) {\n        if (path.charCodeAt(i + offset) !== this.prefix.charCodeAt(offset)) return false\n      }\n      return true\n    }`, "prefixMatch");
  if (id.endsWith("lib/handler-storage.js")) {
    out = replaceOnce(out, `    const fnBody = []\n\n    fnBody.push('const fn = function _createParamsObject (paramsArray) {')\n\n    fnBody.push('const params = new NullObject()')\n    for (let i = 0; i < params.length; i++) {\n      fnBody.push(\`params['\${params[i]}'] = paramsArray[\${i}]\`)\n    }\n    fnBody.push('return params')\n    fnBody.push('}')\n\n    fnBody.push('return fn')\n\n    return new Function('NullObject', fnBody.join('\\n'))(NullObject)  // eslint-disable-line`, `    return function _createParamsObject (paramsArray) {\n      const result = new NullObject()\n      for (let i = 0; i < params.length; i++) result[params[i]] = paramsArray[i]\n      return result\n    }`, "paramsObject");
    out = replaceOnce(out, `    const lines = []\n    lines.push(\`\n    let candidates = \${(1 << this.handlers.length) - 1}\n    let mask, matches\n    \`)`, `    const lines = []\n    lines.push(\`\n    let candidates = \${(1 << this.handlers.length) - 1}\n    let mask, matches\n    \`)`, "constraintmatcher sentinel");
    const start = out.indexOf("    const lines = []\n    lines.push(`\n    let candidates =");
    const end = out.indexOf("    this._getHandlerMatchingConstraints = new Function('derivedConstraints'", start);
    if (start < 0 || end < 0) throw new Error("find-my-way constraintmatcher boundaries changed");
    const tail = out.indexOf("\n  }", end);
    const body = `    this._getHandlerMatchingConstraints = (derivedConstraints) => {\n      let candidates = (1 << this.handlers.length) - 1\n      for (const constraint of this.constraints) {\n        const mask = this._constrainedIndexBitmask(constraint)\n        const value = derivedConstraints[constraint]\n        if (value === undefined) candidates &= mask\n        else {\n          const matches = this.constrainedHandlerStores[constraint].get(value) || 0\n          const strategy = constrainer.strategies[constraint]\n          candidates &= strategy.mustMatchWhenDerived ? matches : (matches | mask)\n        }\n        if (candidates === 0) return null\n      }\n      for (const constraint in constrainer.strategies) {\n        const strategy = constrainer.strategies[constraint]\n        if (Object.hasOwn(constrainer.strategies, constraint) && strategy.mustMatchWhenDerived && !this.constraints.includes(constraint) && derivedConstraints[constraint] !== undefined) return null\n      }\n      return this.handlers[31 - Math.clz32(candidates)]\n    }`;
    out = out.slice(0, start) + body + out.slice(tail);
  }
  if (id.endsWith("lib/constrainer.js")) {
    const start = out.indexOf("    const lines = ['return {']");
    const endNeedle = "    this.deriveSyncConstraints = new Function('req', 'ctx', lines.join('\\n')).bind(this) // eslint-disable-line";
    if (out.split(endNeedle).length - 1 !== 1) throw new Error("find-my-way deriveConstraints target expected once");
    const end = out.indexOf(endNeedle, start);
    if (start < 0 || end < 0 || out.indexOf("    const lines = ['return {'", start + 1) >= 0) throw new Error("find-my-way deriveConstraints replacement boundaries changed");
    const replacement = `    this.deriveSyncConstraints = (req, ctx) => {\n      const result = {}\n      for (const key of this.strategiesInUse) {\n        const strategy = this.strategies[key]\n        if (!strategy.isCustom) result[key] = key === 'version' ? req.headers['accept-version'] : (req.headers.host || req.headers[':authority'])\n        else result[strategy.name] = strategy.deriveConstraint(req, ctx)\n      }\n      return result\n    }`;
    out = out.slice(0, start) + replacement + out.slice(end + endNeedle.length);
  }
  return out;
}

export function findMyWayJitPlugin() {
  return { name: "knithot-find-my-way-no-jit", setup(build) {
    build.onLoad({ filter: /find-my-way[\\/]lib[\\/](node|handler-storage|constrainer)\.js$/ }, async (args) => ({ contents: transformFindMyWaySource(await readFile(args.path, "utf8"), args.path), loader: "js" }));
  } };
}
