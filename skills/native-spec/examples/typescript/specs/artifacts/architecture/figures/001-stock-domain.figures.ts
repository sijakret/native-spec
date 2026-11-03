import { figure } from "../../factory.js";

export const orderStates = figure(
  new URL("../001-stock-domain.abb.ts", import.meta.url).href,
  1,
  "Order reservation states",
);