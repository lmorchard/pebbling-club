import parseDuration from "parse-duration";

export function parseSince(since?: string) {
  if (!since) return;

  const sinceDuration = parseDuration(since);
  const sinceDate = sinceDuration
    ? new Date(Date.now() - sinceDuration)
    : undefined;
  return sinceDate;
}
