import fs from 'node:fs';
import path from 'node:path';
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
export function detectStack(cwd=process.cwd()){
  const root=path.resolve(cwd);
  const pkg=readJson(path.join(root,'package.json'))||{};
  const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{}),...(pkg.peerDependencies||{})};
  if(deps.next) return {id:'nextjs',confidence:1,source:'package.json'};
  if(deps.react) return {id:'react',confidence:.95,source:'package.json'};
  if(deps['react-native']) return {id:'react-native',confidence:.95,source:'package.json'};
  if(deps.vue||deps['@vitejs/plugin-vue']) return {id:'vue',confidence:.9,source:'package.json'};
  if(deps.svelte||deps['@sveltejs/kit']) return {id:'svelte',confidence:.9,source:'package.json'};
  if(deps.astro) return {id:'astro',confidence:.9,source:'package.json'};
  if(deps['@angular/core']) return {id:'angular',confidence:.9,source:'package.json'};
  if(deps['@shopify/flash-list']||deps.expo) return {id:'react-native',confidence:.9,source:'package.json'};
  if(fs.existsSync(path.join(root,'pubspec.yaml'))) return {id:'flutter',confidence:1,source:'pubspec.yaml'};
  if(fs.existsSync(path.join(root,'Package.swift'))||fs.readdirSync(root,{withFileTypes:true}).some((entry)=>entry.isDirectory()&&entry.name.endsWith('.xcodeproj'))) return {id:'swiftui',confidence:.8,source:'filesystem'};
  return {id:'html-tailwind',confidence:.35,source:'fallback'};
}
