/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // إضافة خطوط مناسبة للنظام العربي
        sans: ['Noto Sans Arabic', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
