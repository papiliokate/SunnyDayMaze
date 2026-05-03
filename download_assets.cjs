const cp = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
cp.execSync(`"${ffmpeg}" -y -f lavfi -i "mandelbrot=size=720x640:rate=30" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 10 -c:v libx264 -pix_fmt yuv420p -c:a aac public/asmr/mandelbrot_asmr.mp4`);
console.log("Assets with audio created");
