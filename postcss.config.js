// postcss.config.js
import tailwindcss from '@tailwindcss/postcss'; // ここを修正
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss, // ここは変更なし
    autoprefixer,
  ],
};