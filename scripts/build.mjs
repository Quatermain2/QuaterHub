import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('public',{recursive:true});
await copyFile('src/dashboard.html','public/dashboard.html');
console.log('Desktop dashboard ready. Runtime data is loaded only after authentication.');
