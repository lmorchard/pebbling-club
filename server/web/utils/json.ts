export function maybeParseJson(raw?: string, onErrorResult?: any) {
  try {
    return raw && JSON.parse(raw);
  } catch (err) {
    return onErrorResult;
  }
}
