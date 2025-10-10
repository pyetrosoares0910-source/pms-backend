import React from "react";
import { PlasmicComponent, PlasmicRootProvider } from "@plasmicapp/loader-react";
import { PLASMIC } from "../plasmic-init";

export default function PlasmicPage({ pageName }) {
  return (
    <PlasmicRootProvider loader={PLASMIC}>
      <PlasmicComponent component={pageName} />
    </PlasmicRootProvider>
  );
}
