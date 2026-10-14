/**
 * Reading JSON out of what a model said. Models wrap JSON in a markdown fence
 * often enough that every function reading one needs this. Pure, with no Deno
 * APIs, so the app's unit tests import it directly.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return JSON.parse(fenced ? fenced[1] : text);
}
