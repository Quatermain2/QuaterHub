import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':path.resolve('.')}},define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'.offline-build',emptyOutDir:true,lib:{entry:'offline-entry.tsx',name:'LyudiMarketing',formats:['iife'],fileName:()=> 'dashboard.js'},cssCodeSplit:false,rollupOptions:{output:{inlineDynamicImports:true}}}});
