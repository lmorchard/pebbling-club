import "./index.css";

import "./components/details-closer.ts";
import "./components/theme-selector.ts";
import "./components/pc-bookmark.ts";
import "./components/pc-bookmark-list.ts";
import "./components/pc-bookmark-form.ts";

import "./css/mobile-overrides.css";

async function init() {
  console.log("READY.");
}

init().catch(console.error);
