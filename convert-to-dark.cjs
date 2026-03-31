const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Backgrounds
  content = content.replace(/bg-white/g, 'bg-[#111]');
  content = content.replace(/bg-zinc-50/g, 'bg-brand-black');
  content = content.replace(/bg-zinc-100/g, 'bg-zinc-800/50');
  
  // Text colors
  content = content.replace(/text-zinc-900/g, 'text-brand-white');
  content = content.replace(/text-zinc-800/g, 'text-brand-white');
  content = content.replace(/text-zinc-700/g, 'text-zinc-300');
  content = content.replace(/text-zinc-600/g, 'text-zinc-400');
  content = content.replace(/text-zinc-500/g, 'text-zinc-400');
  
  // Borders
  content = content.replace(/border-zinc-200/g, 'border-zinc-800');
  content = content.replace(/border-zinc-100/g, 'border-zinc-800/50');
  content = content.replace(/border-zinc-300/g, 'border-zinc-700');
  
  // Primary Buttons
  content = content.replace(/bg-zinc-900/g, 'bg-brand-white');
  content = content.replace(/text-white/g, 'text-brand-black');
  content = content.replace(/hover:bg-zinc-800/g, 'hover:bg-gray-200');
  
  fs.writeFileSync(filePath, content);
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('./src/components');
console.log('Dark mode conversion complete.');
