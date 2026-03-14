import { defineConfig } from 'orval'

export default defineConfig({
    deployguard: {
        input: {
            target: 'https://analysis.deployguard.org/openapi.json',
        },
        output: {
            mode: 'tags-split',
            target: 'src/api/generated',
            schemas: 'src/api/model',
            client: 'react-query',
            override: {
                mutator: {
                    path: './src/api/client.ts',
                    name: 'apiClient',
                },
            },
        },
    },
})