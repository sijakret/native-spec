import { artifactFactory } from "../definition/engine.js";

export const artifact = artifactFactory("acme-notes");

export const completedTask = (text: string) => ({ text, done: true }) as const;
