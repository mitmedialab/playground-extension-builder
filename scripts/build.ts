import { fork, type ChildProcess } from 'child_process';
import path from "path";
import fs from "fs";
import { Message, Conditon } from './comms';
import { extensionsFolder, scratchPackages, root } from './paths';
import options, { convertToFlags, asFlags } from './options';

const { gui } = scratchPackages;

const watch = false;

const extensionsScripts = path.join(extensionsFolder, "scripts");
const bundleExtensionsScript = path.join(extensionsScripts, "bundle.ts");

console.log("PROCESS")
console.log(process.argv);

const bundleExtensions = fork(bundleExtensionsScript, process.argv);

const childProcesses: Record<string, ChildProcess> = {
  bundleExtensions
}

bundleExtensions.on("message", (msg: Message) => {
  const { condition: flag } = msg;
  switch (flag) {
    case Conditon.ErrorBundlingExtensions:
      Object.values(childProcesses).forEach(child => child?.kill());
      break;
    case Conditon.ExtensionsSuccesfullyBundled:
      Object.values(childProcesses).forEach(child => child?.kill());
      break;
  }
});
