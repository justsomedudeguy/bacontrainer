/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 20px 45px rgba(63, 36, 17, 0.12)'
      },
      colors: {
        parchment: '#fbf5e7',
        ink: '#1f1a17',
        ember: '#9a3412',
        brass: '#8b5e34',
        mist: '#e8eef8'
      }
    }
  },
  plugins: []
};
