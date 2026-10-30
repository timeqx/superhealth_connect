"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const authPaths = new Set(["/sign-in", "/register", "/forgot-password", "/reset-password", "/staff/sign-in", "/staff/forgot-password", "/staff/reset-password"]);

export function ContentTransition({ children, className = "route-content", changeKey = "", excludeAuth = false }: {
  children: ReactNode; className?: string; changeKey?: string; excludeAuth?: boolean;
}) {
  const path = usePathname();
  const node = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if ((excludeAuth && authPaths.has(path)) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = node.current?.animate(
      [{ opacity: 0.7, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 180, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [path, changeKey, excludeAuth]);
  return <div ref={node} className={className}>{children}</div>;
}
