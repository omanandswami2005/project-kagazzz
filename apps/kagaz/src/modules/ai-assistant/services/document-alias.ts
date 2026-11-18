/**
 * Short ids for the model. A 2B on-device model copying 36-character random
 * UUIDs mangles them — dropped characters, broken quote tokens — and the native
 * tool-call parser then rejects the whole call ("Failed to parse tool calls",
 * seen on a phone merging three documents). The model therefore only ever sees
 * `doc1`, `doc2`, …; every UUID in text going to it is swapped for its alias and
 * every alias in the arguments coming back is swapped for the real id.
 *
 * Process-lifetime and deterministic per id, so aliases stay stable across
 * turns and across the tool results the model already has in context.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const aliasById = new Map<string, string>();
const idByAlias = new Map<string, string>();

function aliasFor(id: string): string {
  const key = id.toLowerCase();
  let alias = aliasById.get(key);
  if (!alias) {
    alias = `doc${aliasById.size + 1}`;
    aliasById.set(key, alias);
    idByAlias.set(alias, id);
  }
  return alias;
}

/** Text going TO the model: real document ids become short aliases. */
export function encodeForModel(text: string): string {
  return text.replace(UUID, (id) => aliasFor(id));
}

/**
 * Tool-argument JSON coming FROM the model: a string value that is exactly an alias becomes the real
 * id. Only whole values are touched, so a watermark text that happens to read "doc1" is left alone.
 */
export function decodeFromModel(json: string): string {
  return json.replace(/"(doc\d+)"/g, (whole, alias: string) => {
    const id = idByAlias.get(alias);
    return id ? `"${id}"` : whole;
  });
}

/** Test helper: forget every alias. */
export function resetAliases(): void {
  aliasById.clear();
  idByAlias.clear();
}
