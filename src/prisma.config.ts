import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import path from 'node:path';

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  engine: 'classic',
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    url: env<Env>('DATABASE_URL'),
  },
});
