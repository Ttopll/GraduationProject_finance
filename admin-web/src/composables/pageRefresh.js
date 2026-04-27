import { onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";

const refreshHandlers = new Map();

export function registerPageRefresh(routeName, handler) {
  if (!routeName || typeof handler !== "function") {
    return;
  }
  refreshHandlers.set(String(routeName), handler);
}

export function unregisterPageRefresh(routeName, handler) {
  if (!routeName) {
    return;
  }
  const current = refreshHandlers.get(String(routeName));
  if (!handler || current === handler) {
    refreshHandlers.delete(String(routeName));
  }
}

export async function triggerPageRefresh(routeName) {
  const handler = refreshHandlers.get(String(routeName || ""));
  if (!handler) {
    return false;
  }
  await handler();
  return true;
}

export function usePageRefresh(handler) {
  const route = useRoute();

  onMounted(() => {
    registerPageRefresh(route.name, handler);
  });

  onBeforeUnmount(() => {
    unregisterPageRefresh(route.name, handler);
  });
}
