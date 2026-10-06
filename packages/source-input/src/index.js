/**
 * Transport-agnostic source input envelope. No I/O, SDK dependency, brand or host identity.
 * Local paths are resolved by a Node/Desktop adapter; Blob/bytes by browser/Node;
 * URLs and provider references require explicit, authorized adapters.
 */
export const SOURCE_INPUT_SCHEMA = 'agentsam.source-input.v1';

export function normalizeSourceInput(value) {
  if (typeof value === 'string') {
    if (value === '-') return Object.freeze({ kind: 'stdin' });
    if (/^https?:\/\//i.test(value)) return Object.freeze({ kind: 'url', url: value });
    if (!value.trim()) throw new TypeError('source path cannot be empty');
    return Object.freeze({ kind: 'local-path', path: value });
  }
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return Object.freeze({ kind: 'bytes', bytes: value instanceof Uint8Array ? value : new Uint8Array(value), name: 'input' });
  }
  if (!value || typeof value !== 'object') throw new TypeError('invalid source input');
  const kind = value.kind;
  if (kind === 'local-path' || kind === 'directory') {
    if (typeof value.path !== 'string' || !value.path.trim()) throw new TypeError('source path is required');
    return Object.freeze({ kind, path: value.path });
  }
  if (kind === 'stdin') return Object.freeze({ kind });
  if (kind === 'bytes') {
    if (!(value.bytes instanceof Uint8Array) && !(value.bytes instanceof ArrayBuffer)) throw new TypeError('bytes must be Uint8Array or ArrayBuffer');
    return Object.freeze({ kind, bytes: value.bytes instanceof Uint8Array ? value.bytes : new Uint8Array(value.bytes), name: safeName(value.name || 'input') });
  }
  if (kind === 'blob') {
    if (!value.blob || typeof value.blob.arrayBuffer !== 'function') throw new TypeError('blob.arrayBuffer is required');
    return Object.freeze({ kind, blob: value.blob, name: safeName(value.name || value.blob.name || 'input') });
  }
  if (kind === 'url') {
    const url = new URL(value.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError('only HTTP(S) source URLs are supported');
    return Object.freeze({ kind, url: url.href });
  }
  if (kind === 'provider-ref') {
    if (!value.provider || !value.ref) throw new TypeError('provider and ref are required');
    return Object.freeze({ kind, provider: String(value.provider), ref: String(value.ref) });
  }
  throw new TypeError('unsupported source kind: ' + String(kind));
}

function safeName(name) {
  const cleaned = String(name).replace(/\\/g, '/').split('/').pop();
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'input';
}

export function normalizeSourceInputs(inputs) {
  return (Array.isArray(inputs) ? inputs : [inputs]).map(normalizeSourceInput);
}
