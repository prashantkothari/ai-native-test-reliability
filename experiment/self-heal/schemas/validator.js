/* self-heal/schemas/validator.js — tiny AJV-free JSON validator (browser JS, no Node).
 *
 * Supports the subset we actually use in our schemas:
 *   type (string|number|integer|boolean|object|array|null; or an array of types for unions)
 *   required[]         (object)
 *   properties{}       (object)
 *   additionalProperties (object)   — true|false (default true)
 *   enum[]             (any)
 *   const              (any)
 *   pattern            (string, JS RegExp)
 *   minLength/maxLength (string)
 *   minimum/maximum    (number)
 *   items              (array — a single schema applied to every item)
 *   minItems/maxItems  (array)
 *   oneOf/anyOf[]      (any — at least one schema matches)
 *
 * Returns { ok:boolean, errors:[{ path, msg }] }. Path is dotted; array indices in [n].
 * Errors are collected (not first-fail) so the harness can show them all at once.
 */
(function (root) {
  const typeOf = v =>
    v === null ? 'null' :
    Array.isArray(v) ? 'array' :
    Number.isInteger(v) ? 'integer' :
    typeof v;   // 'string'|'number'|'boolean'|'object'|'undefined'

  function checkType(schemaType, actual) {
    if (!schemaType) return true;
    const list = Array.isArray(schemaType) ? schemaType : [schemaType];
    // 'number' accepts integers too; 'integer' does not accept floats
    return list.some(t => t === actual || (t === 'number' && actual === 'integer'));
  }

  function validate(schema, obj, path, errs) {
    path = path || '$';
    errs = errs || [];
    const push = m => errs.push({ path, msg: m });

    if (!schema || typeof schema !== 'object') { push('schema is not an object'); return errs; }

    const actual = typeOf(obj);

    if (schema.type && !checkType(schema.type, actual)) {
      push('expected type ' + JSON.stringify(schema.type) + ', got ' + actual);
      return errs;   // downstream checks assume the type — bail early
    }

    if ('const' in schema && obj !== schema.const) push('expected const ' + JSON.stringify(schema.const) + ', got ' + JSON.stringify(obj));
    if (schema.enum && !schema.enum.some(v => v === obj)) push('expected one of ' + JSON.stringify(schema.enum) + ', got ' + JSON.stringify(obj));

    if (actual === 'string') {
      if (typeof schema.minLength === 'number' && obj.length < schema.minLength) push('minLength ' + schema.minLength);
      if (typeof schema.maxLength === 'number' && obj.length > schema.maxLength) push('maxLength ' + schema.maxLength);
      if (schema.pattern && !new RegExp(schema.pattern).test(obj)) push('does not match pattern ' + schema.pattern);
    }
    if (actual === 'number' || actual === 'integer') {
      if (typeof schema.minimum === 'number' && obj < schema.minimum) push('minimum ' + schema.minimum);
      if (typeof schema.maximum === 'number' && obj > schema.maximum) push('maximum ' + schema.maximum);
    }
    if (actual === 'object') {
      const props = schema.properties || {};
      const req = schema.required || [];
      req.forEach(k => { if (!(k in obj)) errs.push({ path, msg: 'missing required field "' + k + '"' }); });
      const addl = schema.additionalProperties;
      Object.keys(obj).forEach(k => {
        if (props[k]) validate(props[k], obj[k], path + '.' + k, errs);
        else if (addl === false) errs.push({ path: path + '.' + k, msg: 'unexpected field (additionalProperties=false)' });
      });
    }
    if (actual === 'array') {
      if (typeof schema.minItems === 'number' && obj.length < schema.minItems) push('minItems ' + schema.minItems);
      if (typeof schema.maxItems === 'number' && obj.length > schema.maxItems) push('maxItems ' + schema.maxItems);
      if (schema.items) obj.forEach((v, i) => validate(schema.items, v, path + '[' + i + ']', errs));
    }

    // anyOf: at least one branch must fully pass. oneOf: EXACTLY one branch must pass (JSON Schema semantics).
    function countBranchesPassing(branches) {
      return branches.filter(sub => validate(sub, obj, path, []).length === 0).length;
    }
    if (schema.oneOf) {
      const n = countBranchesPassing(schema.oneOf);
      if (n !== 1) push('expected exactly one match in oneOf, matched ' + n);
    }
    if (schema.anyOf && countBranchesPassing(schema.anyOf) === 0) push('does not match any schema in anyOf');

    return errs;
  }

  const API = {
    validate: function (schema, obj) {
      const errs = validate(schema, obj);
      return { ok: errs.length === 0, errors: errs };
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_VALIDATOR = API;
})(typeof window !== 'undefined' ? window : globalThis);
