import { lazy } from "react";

export const LazyBoardCanvas = lazy(async () => {
  const module = await import("./BoardCanvas");

  return {
    default: module.BoardCanvas,
  };
});
