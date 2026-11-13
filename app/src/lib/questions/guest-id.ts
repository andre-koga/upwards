const GUEST_ID_KEY = "upwards:guest_id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Store = Pick<Storage, "getItem" | "setItem">;

/**
 * The random id a signed-out visitor's daily answers are counted under. It is
 * made here and kept here: it is not the sync device id and nothing on the
 * server ties it to an account, so an answer given as a guest cannot be traced
 * to a person.
 */
export function getOrCreateGuestId(
  store: Store = localStorage,
  make: () => string = () => crypto.randomUUID()
): string {
  const existing = store.getItem(GUEST_ID_KEY);
  if (existing && UUID.test(existing)) return existing;
  const id = make();
  store.setItem(GUEST_ID_KEY, id);
  return id;
}
