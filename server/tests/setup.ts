import { config } from 'dotenv';
import path from 'node:path';

/**
 * Tests run against a dedicated `alaap_test` database so a test run can never
 * touch development data. Loaded before any module reads process.env.
 */
config({ path: path.resolve(__dirname, '../.env.test'), override: true });
