/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                claude: {
                    50: '#fef7ee',
                    100: '#fdedd3',
                    200: '#fad6a5',
                    300: '#f7b96d',
                    400: '#f39232',
                    500: '#f0760e',
                    600: '#e15d09',
                    700: '#ba4509',
                    800: '#94370f',
                    900: '#782f10',
                },
            },
        },
    },
    plugins: [],
};
