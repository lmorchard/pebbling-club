import * as esbuild from "esbuild";
import fs from "node:fs/promises";

const CLIENT_SRC_PATH = "./client/web/src";
const CLIENT_BUILD_PATH = "./client/web/build";

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
    // Build JS
    esbuild.build({
      entryPoints: [`${CLIENT_SRC_PATH}/index.ts`],
      bundle: true,
      // minify: true, // someday, i suppose?
      // target: "esnext", // may need tweaking, also upgrade your browser?
      sourcemap: true,
      outfile: `${CLIENT_BUILD_PATH}/index.js`,
    }),
    // Build CSS
    esbuild.build({
      entryPoints: [`${CLIENT_SRC_PATH}/index.css`],
      bundle: true,
      // minify: true, // someday, i suppose?
      sourcemap: true,
      outfile: `${CLIENT_BUILD_PATH}/index.css`,
    }),
  ]);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
