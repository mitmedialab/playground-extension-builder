import express, { Request, Response } from 'express';
import { exec, spawn, fork, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();

// Define the path to the frontend directory
const frontendPath = path.resolve(__dirname, '../../frontend/');

// Serve static files from the frontend directory
app.use(express.static(frontendPath));
app.use(express.json());

const rootDir = path.resolve(__dirname, '../../');

// Serve the main HTML file for all routes
app.get('*', (req, res) => {
  const filePath = path.join(frontendPath, 'index.html');
  console.log(`Serving file: ${filePath}`); // Log the file being served
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      res.status(500).send('Error serving file');
    }
  });
});

app.post('/run-command', (req: Request, res: Response) => {
  const command = `cd ${rootDir} && pnpm ts:node --project ./extensions/scripts/tsconfig.json ./scripts/build.ts --include simple_example`;

  const process = spawn(command, {
    shell: true,
    cwd: rootDir,
  });
    
  // Variables to capture the output and error messages
  let output = '';
  let errorOutput = '';
  
  // Capture the standard output
  process.stdout.on('data', (data) => {
    output += data.toString();
    console.log(data.toString()); // Optionally log to the console
  });
  
  // Capture the standard error output
  process.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.error(data.toString()); // Optionally log errors to the console
  });





  // Handle termination of the process
  process.on('exit', (code, signal) => {
    console.log(`Process exited with code ${code} and signal ${signal}`);
    if (code !== 0) {
      // If the build fails, send an error message to the frontend
      res.status(500).send('Build failed');
    } else {
      // If the build succeeds, send a success message to the frontend
      const sourcePath = path.join(rootDir, 'scratch-packages/scratch-gui/static/extension-bundles/simpleprg95grpexample.js');
      const destinationPath = path.join(rootDir, 'frontend/static/extension-bundles/simpleprg95grpexample.js');

      // Read the source file and write its contents to the destination file
      fs.readFile(sourcePath, 'utf8', (readErr, data) => {
          if (readErr) {
              console.error('Error reading source file:', readErr);
              res.status(500).send('Error reading source file');
              return;
          }

        fs.writeFile(destinationPath, data, 'utf8', (writeErr) => {
            if (writeErr) {
                console.error('Error writing to destination file:', writeErr);
                res.status(500).send('Error writing to destination file');
            } else {
                console.log('File moved successfully');
                res.status(200).send('Build completed successfully and file moved');
            }
        });
      });
    }
  });
});

app.post('/write-file', (req: Request, res: Response) => {
  const filePath = path.join(rootDir, 'extensions/src/simple_example/index.ts');
  const { content } = req.body;

  if (!content) {
    return res.status(400).send('Content is required');
  }

  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error writing to file:', err);
      return res.status(500).send('Failed to write to file');
    }

    console.log(`File written successfully to ${filePath}`);
    res.status(200).send('File written successfully');
  });
});


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

app.post('/show_playground', (req, res) => {
  fs.writeFileSync(path.join(__dirname, 'playground.json'), JSON.stringify(true));
  res.send('Data stored in file!');
});

app.post('/hide_playground', (req, res) => {
  fs.writeFileSync(path.join(__dirname, 'playground.json'), JSON.stringify(false));
  res.send('Data stored in file!');
});

app.post('/get_playground', (req, res) => {
  fs.readFile(path.join(__dirname, 'playground.json'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return;
    }
    res.json(data);
    console.log('File content:', data);
  });
  
});

  
export default app;
