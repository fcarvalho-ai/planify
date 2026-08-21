#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const required = ['server.js', 'app.js', 'index.html', 'styles.css', 'planning.css'];
for (const file of required) {
  const target = path.resolve(file);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile() || fs.statSync(target).size === 0) throw new Error(`Actif runtime absent ou vide : ${file}`);
}
process.stdout.write(`Build local vérifié : ${required.length} actifs runtime.\n`);
