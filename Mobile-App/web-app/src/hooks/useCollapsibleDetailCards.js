import { useEffect } from "react";

const INTERACTIVE_SELECTOR = "button, a, input, select, textarea, [role='button']";

export default function useCollapsibleDetailCards(drawerRef, resetKey) {
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return undefined;

    const cards = Array.from(
      drawer.querySelectorAll(".drawer-page-body > .drawer-stack > .drawer-section")
    );
    const cleanups = [];

    cards.forEach((card) => {
      const trigger =
        card.querySelector(":scope > .detail-card-heading") ||
        card.querySelector(":scope > h3") ||
        card.querySelector(":scope > .drawer-section-header");

      if (!trigger) return;

      card.classList.add("detail-card-collapsible");
      card.classList.add("is-collapsed");
      trigger.classList.add("detail-card-trigger");
      trigger.setAttribute("role", "button");
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("aria-expanded", "false");

      Array.from(card.children).forEach((child) => {
        if (child !== trigger) child.classList.add("detail-card-content");
      });

      const toggle = (event) => {
        const interactiveTarget = event.target.closest(INTERACTIVE_SELECTOR);
        if (interactiveTarget && interactiveTarget !== trigger) return;
        const collapsed = card.classList.toggle("is-collapsed");
        trigger.setAttribute("aria-expanded", String(!collapsed));
      };

      const handleKeyDown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle(event);
      };

      trigger.addEventListener("click", toggle);
      trigger.addEventListener("keydown", handleKeyDown);
      cleanups.push(() => {
        trigger.removeEventListener("click", toggle);
        trigger.removeEventListener("keydown", handleKeyDown);
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [drawerRef, resetKey]);
}
