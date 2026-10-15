// Runs the finish-daily handler tests until the root Vitest include glob covers supabase/functions/finish-daily.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['supabase/functions/finish-daily/**/*.test.ts'], environment: 'node' },
});
