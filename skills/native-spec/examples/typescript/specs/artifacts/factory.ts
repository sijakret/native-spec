import { artifactFactory } from "../definition/process.js";

export { figure } from "../definition/process.js";

export const artifact = artifactFactory("acme-stockroom");

export const completedTask = (text: string) => ({ text, done: true }) as const;
