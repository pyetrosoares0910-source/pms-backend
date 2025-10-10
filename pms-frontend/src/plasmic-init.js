import { initPlasmicLoader } from "@plasmicapp/loader-react";
export const PLASMIC = initPlasmicLoader({
  projects: [
    {
      id: "grYuZrRQ15EGqqvzmCFGd7",  // ID of a project you are using
      token: "C4trpiXF0b6bHJPTRDUBi86F4EaCikLo0s0ey8gLcma5d4tS8MlJHhd3QXDZWxto3kuqFSFN07HUVzNXWsBw"  // API token for that project
    }
  ],
  // Fetches the latest revisions, whether or not they were unpublished!
  // Disable for production to ensure you render only published changes.
  preview: true,
})