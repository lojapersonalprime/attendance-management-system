/** The mobile client never supplies the official punch time. */
export function serverRegisteredAt(now = new Date()) {
  return new Date(now.getTime());
}
