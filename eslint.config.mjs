import js from '@eslint/js'
import globals from 'globals'

export default [
	{ ignores: ['**/node_modules/**', 'frontend/**'] },
	js.configs.recommended,
	{
		files: ['gateway/**/*.js', 'services/**/*.js', 'packages/**/*.js', 'scripts/**/*.mjs', 'e2e/**/*.js'],
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: 'module',
			globals: globals.node,
		},
	},
]
