/** Fit neighboring slide windows, clamping fractional ends and resisted drags. */
export function interpolateSize(
  position: number,
  min: number,
  max: number,
  measure: (position: number) => number,
  anchor?: { position: number; size: number }
) {
  const current = Math.max(min, Math.min(max, position));
  // Include the committed height as an extra stop when offscreen content remaps.
  const start = Math.max(
    min,
    Math.floor(current),
    anchor && current >= anchor.position ? anchor.position : -Infinity
  );
  const end = Math.min(
    max,
    Math.ceil(current),
    anchor && current < anchor.position ? anchor.position : Infinity
  );
  const from =
    anchor && anchor.position === start ? anchor.size : measure(start);
  if (start === end) return from;
  const to = anchor && anchor.position === end ? anchor.size : measure(end);
  return from + (to - from) * ((current - start) / (end - start));
}
