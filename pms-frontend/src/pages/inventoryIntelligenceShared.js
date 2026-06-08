export const INVENTORY_DAILY_OPENED_KEY = "inventory-intelligence-opened-date";
export const INVENTORY_DAILY_OPENED_EVENT = "inventory-intelligence-opened";

export function getInventoryOpenedDate() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(INVENTORY_DAILY_OPENED_KEY) || "";
}

export function markInventoryOpenedToday(dateKey) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INVENTORY_DAILY_OPENED_KEY, dateKey);
  window.dispatchEvent(new CustomEvent(INVENTORY_DAILY_OPENED_EVENT, { detail: { date: dateKey } }));
}
