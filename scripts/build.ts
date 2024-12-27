import { fork, type ChildProcess } from 'child_process';
import path from "path";
import fs from "fs";
import { Message, Conditon } from './comms';
import { extensionsFolder, scratchPackages, root } from './paths';
import options, { convertToFlags, asFlags } from './options';


const { gui } = scratchPackages;

const watch = false;

const getNodeModule = (dir: string, module: string) => path.join(dir, "node_modules", module);

const extensionsScripts = path.join(extensionsFolder, "scripts");
const bundleExtensionsScript = path.join(extensionsScripts, "bundle.ts");

const [guiBuildDir, rootBuildDir] = [gui, root].map(dir => path.join(dir, "build"));

const clearBuildDirs = () => [guiBuildDir, rootBuildDir]
  .filter(fs.existsSync)
  .forEach(dir => fs.rmSync(dir, { force: true, recursive: true }));

const copyOverBuild = () => fs.existsSync(guiBuildDir)
  ? fs.renameSync(guiBuildDir, rootBuildDir)
  : console.error("Could not locate build");

console.log("PROCESS")
console.log(process.argv);

const bundleExtensions = fork(bundleExtensionsScript, process.argv);

const childProcesses: Record<string, ChildProcess> = {
  bundleExtensions,
  serveGui: undefined
}


function waitForFile(filePath: string, timeout = 5000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
      const dir = path.dirname(filePath);
      const fileName = path.basename(filePath);

      // Start watching the directory
      const watcher = fs.watch(dir, (eventType, filename) => {
          if (eventType === 'rename' && filename === fileName) {
              // File created
              watcher.close();
              resolve(); // Correct: No value is passed to resolve
          }
      });

      // Add a timeout to avoid waiting forever
      const timeoutId = setTimeout(() => {
          watcher.close();
          reject(new Error(`Timeout: File ${filePath} was not created in time`));
      }, timeout);

      // Cleanup on process exit
      process.on('exit', () => {
          clearTimeout(timeoutId);
          watcher.close();
      });
  });
}

bundleExtensions.on("message", (msg: Message) => {
  const { condition: flag } = msg;
  switch (flag) {
    case Conditon.ErrorBundlingExtensions:
      Object.values(childProcesses).forEach(child => child?.kill());
      break;
    case Conditon.ExtensionsSuccesfullyBundled:
      const extensionBundlesDirectory = path.join(scratchPackages.gui, "static", "extension-bundles");
      const auxiliaryFile = path.join(extensionBundlesDirectory, `AuxiliaryExtensionInfo.js`);
      waitForFile(auxiliaryFile).then(() => {
        Object.values(childProcesses).forEach(child => child?.kill());
      });
      break;
  }
});
