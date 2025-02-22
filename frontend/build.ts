import * as esbuild from "esbuild";
import fs from "node:fs/promises";

const CLIENT_SRC_PATH = "./src";
const CLIENT_BUILD_PATH = "./build";

const CLIENT_ASSETS_SRC_PATH = `${CLIENT_SRC_PATH}/assets`;
const CLIENT_ASSETS_BUILD_PATH = `${CLIENT_BUILD_PATH}/assets`;

async function main() {
  await Promise.all([
    // Copy over plain assets
    (async () => {
      await fs.rm(CLIENT_ASSETS_BUILD_PATH, { recursive: true, force: true });
      await fs.mkdir(CLIENT_ASSETS_BUILD_PATH, { recursive: true });
      await fs.cp(CLIENT_ASSETS_SRC_PATH, CLIENT_ASSETS_BUILD_PATH, {
        recursive: true,
      });
    })(),
    // Build JS and imported CSS
    esbuild.build({
      entryPoints: [`${CLIENT_SRC_PATH}/index.ts`],
      bundle: true,
      // minify: true, // someday, i suppose?
      // target: "esnext", // may need tweaking, also upgrade your browser?
      sourcemap: true,
      outfile: `${CLIENT_BUILD_PATH}/index.js`,
      // implicitly, index.css is produced as well
    }),
  ]);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
