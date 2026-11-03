import { artifact } from "../factory.js";
import { testedBy } from "../../definition/process.js";
import type * as deploymentTests from "../../../tests/deployment.test.js";

export const cdnApp = artifact.nonFunctionalRequirement({
  id: "REQ-NFR-001",
  title: "Simple CDN-Based Vite App",
  tags: ["deployment"],
  description:
    "A browser-only TypeScript app built by Vite, with the rendering dependency loaded from a pinned CDN URL at runtime.",
  acceptanceCriteria: [
    {
      id: "static-build",
      description:
        "The build is static HTML, CSS, and JavaScript deployable under a CDN subpath, with no application backend.",
      tests: testedBy<[deploymentTests.specBindings["staticBuild"]]>(),
    },
    {
      id: "pinned-cdn",
      description:
        "lit-html is fetched from a version-pinned public CDN at runtime, not bundled; CDN availability and trust are explicit limitations.",
      tests: testedBy<[deploymentTests.specBindings["staticBuild"]]>(),
    },
    {
      id: "loading-failures",
      description:
        "Dependency loading failures show an actionable error. No authentication, encryption, or multi-user consistency is claimed.",
      tests: testedBy<[deploymentTests.specBindings["loadingFailure"]]>(),
    },
  ],
});
