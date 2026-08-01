/** Scrolls the window and the app scroll container (desktop shell) back to the top. */
export function scrollAppToTop() {
  window.scrollTo(0, 0);
  document.querySelector<HTMLElement>("[data-app-scroll]")?.scrollTo(0, 0);
}
