/**
 * The authoring convention of the models: a node's description carries
 *
 *     optional text  $Type:key("prop":value, ...)  trailing text
 *
 * `$Type` is the object type, `key` the answer key (optional) and the
 * parentheses hold the body of a JSON object.
 */

// `\V` of PCRE: anything but a vertical whitespace character.
const NOT_VERTICAL = '[^\\n\\v\\f\\r\\u0085\\u2028\\u2029]';
const DESCRIPTION = new RegExp(`(.+\\s+)?\\$(\\w+)(:(\\w+))?\\((${NOT_VERTICAL}*)\\)(\\s+.+)?`, 's');

const trim = (s: string | undefined | null) => (s ?? '').replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');

export interface Described {
  /** `null` when the description carries no `$Type(...)` expression. */
  type: string | null;
  key: string | null;
  /** Raw JSON object text, `null` when absent. */
  properties: string | null;
  /** The free text around the expression. */
  text: string | null;
}

export function describe(description: string): Described {
  const m = DESCRIPTION.exec(description);
  if (!m) return { type: null, key: null, properties: null, text: null };
  const before = trim(m[1]);
  const after = trim(m[6]);
  return {
    type: m[2] ?? null,
    key: trim(m[4]) || null,
    properties: `{${trim(m[5])}}`,
    text: after || before || null,
  };
}
