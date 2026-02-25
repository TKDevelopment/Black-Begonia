/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{html,ts}",  // Angular templates + components
  ],
  theme: {
    extend: {
      fontFamily: {
        oswald: ['"Oswald"', ...defaultTheme.fontFamily.sans],
        display: ['"Great Vibes"', ...defaultTheme.fontFamily.serif],
        nav: ['"Marcellus"', ...defaultTheme.fontFamily.sans],
        body: ['"Raleway"', ...defaultTheme.fontFamily.sans],
        forum: ['"Forum"', ...defaultTheme.fontFamily.serif],
        roboto: ['"Roboto"', ...defaultTheme.fontFamily.sans],
        lora: ['"Lora"', ...defaultTheme.fontFamily.serif],
        noto: ['"Noto Serif JP"', ...defaultTheme.fontFamily.serif],
      }
    },
  },
  plugins: [],
}
