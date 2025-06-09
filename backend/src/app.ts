import express, { Request, Response } from 'express';
import { exec, spawn, fork, type ChildProcess } from 'child_process';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';

const app = express();

// Define the path to the frontend directory
const frontendPath = path.resolve(__dirname, '../../frontend/');

// Serve static files from the frontend directory
app.use('/', express.static(frontendPath));
app.use(express.json());

const rootDir = path.resolve(__dirname, '../../');

const PORT = 8081;
const wss = new WebSocketServer({ port: PORT });

// // TODO : CHANGE 
// const fileToWatch = "/Users/mayarajan/mit-media/playground-extension-builder/frontend/static/extension-bundles/simpleprg95grpexample.js"

// // NOT NEEDED
// fs.watch(fileToWatch, (eventType) => {
//   console.log("EVENT TYPE");
//   if (eventType === 'change') {
//     console.log('File changed. Broadcasting reload...');
//     wss.clients.forEach((client) => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send('reload');
//       }
//     });
//   }
// });

// Serve the main HTML file for all routes
app.get('/', (req, res) => {
  const filePath = path.join(frontendPath, 'index.html');
  console.log(`Serving file: ${filePath}`); // Log the file being served
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      res.status(500).send('Error serving file');
    }
  });
});

function copyFile(source: string, destination: string, callback: Function) {
  fs.readFile(source, 'utf8', (readErr, data) => {
      if (readErr) {
          console.error(`Error reading source file (${source}):`, readErr);
          callback(readErr);
          return;
      }

      fs.writeFile(destination, data, 'utf8', (writeErr) => {
          if (writeErr) {
              console.error(`Error writing to destination file (${destination}):`, writeErr);
              callback(writeErr);
          } else {
              console.log(`File moved successfully: ${source} -> ${destination}`);
              callback(null);
          }
      });
  });
}

// READ THE AUXILIARY EXTENSION JSON
function readAuxiliaryExtensionInfo(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
              return reject(err);
          }

          // Extract the variable value
          const match = data.match(/var\s+AuxiliaryExtensionInfo\s*=\s*(\{[\s\S]*?\});/);
          if (match && match[1]) {
              try {
                  // Parse the JSON string
                  const json = JSON.parse(match[1]);
                  resolve(json);
              } catch (parseError) {
                  reject(new Error('Failed to parse AuxiliaryExtensionInfo JSON'));
              }
          } else {
              reject(new Error('AuxiliaryExtensionInfo variable not found'));
          }
      });
  });
}

// BUILD THE EXTENSION
app.post('/run-command', (req: Request, res: Response) => {
  
  // Do the full build or partial build
  const { first_run } = req.body; // <-- Ensure this comes from the POST body
  const firstRunArg = first_run ? '--first_run=true' : '--first_run=false';

  const command = `cd ${rootDir} && pnpm ts:node --project ./extensions/scripts/tsconfig.json ./scripts/build.ts --include simple_example ${firstRunArg}`;

  const process = spawn(command, {
    shell: true,
    cwd: rootDir,
  });
    
  // Variables to capture the output and error messages
  let output = '';
  let errorOutput = '';
  
  // Capture the standard output
  process.stdout.on('data', (data) => {
    if (!data.includes("[plugin typescript]") || (data.includes("[plugin typescript]") && data.includes("extensions/src/simple_example"))) {
      output += data.toString();
      console.log(data.toString()); // Optionally log to the console
    }
  });
  
  // Capture the standard error output
  process.stderr.on('data', (data) => {
    if (!data.includes("[plugin typescript]") || (data.includes("[plugin typescript]") && data.includes("extensions/src/simple_example"))) {
      errorOutput += data.toString();
      console.error(data.toString()); // Optionally log errors to the console
    }
  });

  // Handle termination of the process
  process.on('exit', (code, signal) => {
    console.log(`Process exited with code ${code} and signal ${signal}`);
    if (code !== 0) {
      // If the build fails, send an error message to the frontend
      res.status(500).send('Build failed');
    } else {
      // If the build succeeds, copy all necessary files to the frontend
      const sourcePath = path.join(rootDir, 'scratch-packages/scratch-gui/static/extension-bundles/simpleprg95grpexample.js');
      const destinationPath = path.join(rootDir, 'frontend/static/extension-bundles/simpleprg95grpexample.js');
      const sourcePath1 = path.join(rootDir, 'scratch-packages/scratch-gui/static/extension-bundles/simpleprg95grpexample.js.map');
      const destinationPath1 = path.join(rootDir, 'frontend/static/extension-bundles/simpleprg95grpexample.js.map');
      const auxiliaryPathFull = path.join(rootDir, 'frontend/static/extension-bundles/AuxiliaryExtensionInfo.js');
      const auxiliaryPathExtension = path.join(rootDir, 'scratch-packages/scratch-gui/static/extension-bundles/AuxiliaryExtensionInfo.js');

      // Copy both files
      copyFile(sourcePath, destinationPath, (err1: Error) => {
        if (err1) {
            res.status(500).send('Error copying the first file');
            return;
        }
        copyFile(sourcePath1, destinationPath1, (err2: Error) => {
            if (err2) {
                res.status(500).send('Error copying the second file');
            } else {
                readAuxiliaryExtensionInfo(auxiliaryPathFull).then((fullJSON) => {
                  readAuxiliaryExtensionInfo(auxiliaryPathExtension).then((extensionJSON) => {
                    const name = Object.keys(extensionJSON)[0];
                    fullJSON[name] = extensionJSON[name];
                    const content = `var AuxiliaryExtensionInfo = ${JSON.stringify(fullJSON)};`;
                    fs.writeFile(auxiliaryPathFull, content, () => {
                      res.status(200).send('Build completed successfully and files moved');
                    });
                    
                  });
                })
            }
        });
      });
    }
  });
});

// app.post('/write-file', (req: Request, res: Response) => {
//   const filePath = path.join(rootDir, 'extensions/src/simple_example/index.ts');
//   const { content } = req.body;

//   if (!content) {
//     return res.status(400).send('Content is required');
//   }

//   fs.writeFile(filePath, content, 'utf8', (err) => {
//     if (err) {
//       console.error('Error writing to file:', err);
//       return res.status(500).send('Failed to write to file');
//     }

//     console.log(`File written successfully to ${filePath}`);
//     res.status(200).send('File written successfully');
//   });
// });


app.post('/list-directory', (req, res) => {
  const directoryPath = path.join(rootDir, 'extensions/src/simple_example/');
  fs.readdir(directoryPath, (err, files) => {
    if (err) return res.status(500).send(err.message);
    const fileList = files.map(file => ({ name: file, path: `${directoryPath}/${file}` }));
    return res.status(200).send(JSON.stringify(fileList));
  });
});


app.post('/open-file', (req, res) => {
  const { content } = req.body; // Explicitly cast to string
  const filePath = content;

  if (!filePath) {
    res.status(400).send('File path is required.');
    return;
  }

  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    res.send(data);
  });
});

app.post('/save-file', (req, res) => {
  const { path, content } = req.body;
  fs.writeFile(path, content, err => {
    if (err) return res.status(500).send(err.message);
    res.send('File saved successfully!');
  });
});

  
export default app;
