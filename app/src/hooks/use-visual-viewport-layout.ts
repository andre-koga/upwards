import { useLayoutEffect, useState } from "react";

/**
 * Tracks the Visual Viewport (visible area, excluding on-screen keyboard / browser chrome).
 * - centerY: vertical center for `position: fixed` dialogs
 * - bottomInset: space to add above the physical bottom (lift bottom-anchored panels)
 */
export function useVisualViewportLayout() {
  const [state, setState] = useState<{
    centerY: string;
    bottomInset: number;
  }>({ centerY: "50%", bottomInset: 0 });

  useLayoutEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      const vv = window.visualViewport;
      if (!vv) {
        setState({ centerY: "50%", bottomInset: 0 });
        return;
      }
      setState({
        centerY: `${vv.offsetTop + vv.height / 2}px`,
        bottomInset: Math.max(
          0,
          window.innerHeight - (vv.offsetTop + vv.height)
        ),
      });
    };
    update();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);

  return state;
}
