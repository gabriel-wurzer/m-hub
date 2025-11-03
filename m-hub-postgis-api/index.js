// index.js — launch dirt as a child process so we don't rely on import/export shape
const { spawn } = require('child_process');
const path = require('path');

// path to the dirt package's entrypoint file inside node_modules
const dirtEntry = path.join(__dirname, 'node_modules', 'dirt-simple-postgis-http-api', 'index.js');


// const env = { ...process.env, PORT: '3002' };

// Launch a new Node process that runs Dirt's index.js
const child = spawn(process.execPath, [dirtEntry], {
  env: process.env,
  stdio: 'inherit' // pipe stdout/stderr so docker logs show it
});

// propagate signals so the child can exit cleanly
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`dirt process exited with signal ${signal}`);
    process.exit(1);
  } else {
    console.log(`dirt process exited with code ${code}`);
    process.exit(code);
  }
});
