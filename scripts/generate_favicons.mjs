import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'public', 'brand', 'logo.jpg');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');
const APP_DIR = path.join(ROOT, 'src', 'app');
const BRAND_DIR = path.join(ROOT, 'public', 'brand');

const COMPANY_NAME = 'Chhatrapati Shivaji\u2019s Creative Solutions';
const SHORT_NAME = 'CS Recruit';

async function generate() {
  console.log('Generating favicon and icon assets from:', SOURCE);

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // 1. Crop octagon badge mark (x: 46 to 228, y: 234 to 404)
  // Badge dimensions: ~172 wide x 160 high. Centered in 192x192 square with clean white background
  const octBuf = await sharp(SOURCE)
    .extract({ left: 46, top: 234, width: 182, height: 170 })
    .toBuffer();

  const octSquareBuf = await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: octBuf, gravity: 'center' }])
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(path.join(BRAND_DIR, 'logo-mark.png'), octSquareBuf);
  console.log('✓ Created public/brand/logo-mark.png (octagon mark)');

  // 2. Full artwork banner cropped (x: 46, y: 230, width: 574, height: 175)
  const fullCroppedBuf = await sharp(SOURCE)
    .extract({ left: 46, top: 230, width: 574, height: 175 })
    .png({ quality: 95 })
    .toBuffer();

  // Full banner with nice padding (640x240)
  const logoBannerBuf = await sharp({
    create: {
      width: 640,
      height: 240,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: fullCroppedBuf, gravity: 'center' }])
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(path.join(BRAND_DIR, 'logo-banner.png'), logoBannerBuf);

  // Master square logo (512x512) contain-fit
  const logo512Buf = await sharp(SOURCE)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 95 })
    .toBuffer();

  const logo256Buf = await sharp(SOURCE)
    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(path.join(BRAND_DIR, 'logo.png'), logo512Buf);
  fs.writeFileSync(path.join(BRAND_DIR, 'logo-256.png'), logo256Buf);
  console.log('✓ Created public/brand/logo.png & logo-256.png');

  // 3. Favicon set from the crisp octagon mark (so it is easily readable at small resolutions on light/dark tab bars)
  const ico16 = await sharp(octSquareBuf).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(octSquareBuf).resize(32, 32).png().toBuffer();
  const ico48 = await sharp(octSquareBuf).resize(48, 48).png().toBuffer();

  const icoBuf = await pngToIco([ico16, ico32, ico48]);
  fs.writeFileSync(path.join(APP_DIR, 'favicon.ico'), icoBuf);
  fs.writeFileSync(path.join(ROOT, 'public', 'favicon.ico'), icoBuf);
  console.log('✓ Created src/app/favicon.ico & public/favicon.ico (multi-size: 16, 32, 48)');

  // 4. App icons & Apple touch icons
  const apple180Buf = await sharp(octSquareBuf).resize(180, 180).png({ quality: 95 }).toBuffer();
  fs.writeFileSync(path.join(APP_DIR, 'apple-icon.png'), apple180Buf);
  fs.writeFileSync(path.join(ROOT, 'public', 'apple-icon.png'), apple180Buf);

  const icon512Buf = await sharp(octSquareBuf).resize(512, 512).png({ quality: 95 }).toBuffer();
  fs.writeFileSync(path.join(APP_DIR, 'icon.png'), icon512Buf);
  fs.writeFileSync(path.join(ROOT, 'public', 'icon.png'), icon512Buf);
  console.log('✓ Created src/app/icon.png & src/app/apple-icon.png');

  // 5. PWA Icons
  const icon192Buf = await sharp(octSquareBuf).resize(192, 192).png({ quality: 95 }).toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), icon192Buf);
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), icon512Buf);

  // Maskable 512
  const inner410Buf = await sharp(octSquareBuf).resize(410, 410).png().toBuffer();
  const maskable512Buf = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: inner410Buf, gravity: 'center' }])
    .png({ quality: 95 })
    .toBuffer();
  fs.writeFileSync(path.join(ICONS_DIR, 'maskable-512.png'), maskable512Buf);
  console.log('✓ Created PWA icons in public/icons/');

  // 6. Web Manifest
  const manifest = {
    name: `${COMPANY_NAME} Recruitment Desk`,
    short_name: SHORT_NAME,
    description: `High-velocity recruitment and candidate screening desk for ${COMPANY_NAME}`,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  fs.writeFileSync(path.join(ROOT, 'public', 'site.webmanifest'), JSON.stringify(manifest, null, 2));
  console.log('✓ Created public/site.webmanifest');
  console.log('Done!');
}

generate().catch((err) => {
  console.error('Generation error:', err);
  process.exit(1);
});
