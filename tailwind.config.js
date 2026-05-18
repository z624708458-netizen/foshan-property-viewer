/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{html,tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4A90D9',
          light: '#E8F4FD',
          dark: '#3570B0',
        },
      },
      fontFamily: {
        sans: ['"Microsoft YaHei"', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // 避免与 Ant Design 样式冲突
  },
}
