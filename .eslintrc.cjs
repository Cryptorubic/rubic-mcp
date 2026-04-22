module.exports = {
    root: true,
    ignorePatterns: ['dist/**', 'node_modules/**'],
    overrides: [
        {
            files: ['src/**/*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: __dirname,
                createDefaultProgram: true
            },
            plugins: ['import', '@typescript-eslint', 'unused-imports', 'simple-import-sort'],
            extends: ['airbnb-typescript/base', 'plugin:prettier/recommended', 'prettier'],
            rules: {
                'import/prefer-default-export': 'off',
                'import/extensions': [
                    'error',
                    'ignorePackages',
                    {
                        js: 'always',
                        mjs: 'always',
                        jsx: 'never'
                    }
                ],
                '@typescript-eslint/no-useless-constructor': 'off',
                'class-method-use-this': 'off',
                'no-underscore-dangle': 'off',
                '@typescript-eslint/no-explicit-any': 'error',
                '@typescript-eslint/no-unused-vars': 'off',
                'simple-import-sort/imports': 'error',
                'simple-import-sort/exports': 'error',
                'unused-imports/no-unused-imports': 'error',
                'unused-imports/no-unused-vars': [
                    'error',
                    {
                        vars: 'all',
                        args: 'all',
                        ignoreRestSiblings: false,
                        varsIgnorePattern: '^_',
                        argsIgnorePattern: '^_'
                    }
                ],
                'class-methods-use-this': 'off',
                complexity: ['error', 20],
                eqeqeq: ['error', 'smart'],
                '@typescript-eslint/naming-convention': [
                    'error',
                    {
                        selector: 'enumMember',
                        format: ['UPPER_CASE']
                    }
                ],
                'no-empty': ['error', { allowEmptyCatch: true }],
                'no-bitwise': 'off',
                'padding-line-between-statements': [
                    'error',
                    { blankLine: 'always', prev: 'import', next: '*' },
                    { blankLine: 'any', prev: 'import', next: 'import' }
                ],
                'array-bracket-spacing': ['error', 'never'],
                'object-curly-spacing': ['error', 'always'],
                indent: 'off',
                'comma-dangle': 'off',
                '@typescript-eslint/comma-dangle': ['error', 'never'],
                'import/no-extraneous-dependencies': 'off',
                '@typescript-eslint/dot-notation': 'off',
                'no-restricted-globals': 'off',
                '@typescript-eslint/no-empty-function': 'off',
                'no-param-reassign': 'off',
                'max-classes-per-file': 'off',
                radix: ['warn', 'as-needed'],
                'no-prototype-builtins': 'off',
                'no-return-assign': 'off',
                'no-restricted-syntax': [
                    'error',
                    {
                        selector: 'TSEnumDeclaration',
                        message: "Don't declare enums"
                    },
                    'LabeledStatement',
                    'WithStatement'
                ],
                'no-console': [
                    'warn',
                    {
                        allow: ['debug', 'error', 'info']
                    }
                ],
                '@typescript-eslint/no-shadow': 'off',
                '@typescript-eslint/return-await': 'off',
                'prefer-destructuring': 'off',
                'prettier/prettier': [
                    'error',
                    {
                        singleQuote: true,
                        trailingComma: 'none',
                        tabWidth: 4,
                        semi: true,
                        bracketSpacing: true,
                        endOfLine: 'auto',
                        printWidth: 140
                    }
                ]
            }
        }
    ]
};
