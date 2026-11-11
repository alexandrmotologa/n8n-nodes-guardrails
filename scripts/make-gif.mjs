import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(__dirname, '../docs/images');
const outputFile = path.join(imagesDir, 'n8n_nodes_guardrails_demo.gif');

// Create concat list file
const concatFile = path.join(imagesDir, 'frames.txt');
const frames = [
  'n8n_nodes_guardrails_dashboard.png',
  'n8n_nodes_guardrails_terminal.png',
  'n8n_nodes_guardrails_audit.png',
  'n8n_nodes_guardrails_mobile.png'
];

let concatContent = '';
for (const frame of frames) {
  // 2.5 seconds per frame
  concatContent += `file '${frame}'\nduration 2.5\n`;
}
// Repeat the last frame for duration to be respected by concat demuxer
concatContent += `file '${frames[frames.length - 1]}'\n`;

fs.writeFileSync(concatFile, concatContent, 'utf-8');

console.log('Generating high-quality demo GIF with ffmpeg...');

const paletteFile = path.join(imagesDir, 'palette.png');

try {
  // Step 1: Generate palette for best color fidelity
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vf "fps=10,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" "${paletteFile}"`,
    { stdio: 'inherit' }
  );

  // Step 2: Render GIF using the generated palette
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -i "${paletteFile}" -lavfi "fps=10,scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3" "${outputFile}"`,
    { stdio: 'inherit' }
  );

  // Clean up temporary files
  if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
  if (fs.existsSync(paletteFile)) fs.unlinkSync(paletteFile);

  console.log(`Demo GIF generated successfully at: ${outputFile}`);
} catch (err) {
  console.error('Error generating GIF:', err);
  process.exit(1);
}
