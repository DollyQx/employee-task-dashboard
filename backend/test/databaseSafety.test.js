const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { assertSafeStagingDatabase, parseUrlDetails } = require('../utils/databaseSafety');

describe('Database Safety Guard Unit Tests', () => {
  test('rejects empty, undefined, or malformed connection strings', () => {
    assert.throws(() => assertSafeStagingDatabase(''), /not configured/);
    assert.throws(() => assertSafeStagingDatabase(null), /not configured/);
    assert.throws(() => assertSafeStagingDatabase(undefined), /not configured/);
    assert.throws(() => assertSafeStagingDatabase('   '), /not configured/);
    assert.throws(() => assertSafeStagingDatabase('not-a-valid-url'), /not a valid PostgreSQL connection/);
  });

  test('rejects when TEST_DATABASE_URL is identical to DATABASE_URL', () => {
    const url = 'postgresql://user:pass@ep-sample-1234.us-east-2.aws.neon.tech/neondb?sslmode=require';
    assert.throws(
      () => assertSafeStagingDatabase(url, url),
      /identical to DATABASE_URL/
    );
  });

  test('rejects when host and database match DATABASE_URL even with different credentials or query params', () => {
    const prodUrl = 'postgresql://admin_user:secret_prod_pass@ep-snowy-09523508.us-east-2.aws.neon.tech/main_db?sslmode=require';
    const testUrl = 'postgresql://test_user:different_pass@ep-snowy-09523508.us-east-2.aws.neon.tech/main_db?sslmode=verify-full&pool=true';

    assert.throws(
      () => assertSafeStagingDatabase(testUrl, prodUrl),
      /points to the same host/
    );
  });

  test('rejects production database names even when DATABASE_URL is not set', () => {
    const unsafeUrls = [
      'postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/production?sslmode=require',
      'postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/prod?sslmode=require',
      'postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/taskflow_prod?sslmode=require',
      'postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/taskflow_production?sslmode=require',
    ];

    for (const url of unsafeUrls) {
      assert.throws(
        () => assertSafeStagingDatabase(url, undefined),
        /indicates a production database/,
        `Should have rejected ${url}`
      );
    }
  });

  test('rejects production endpoints or branches for project snowy-dream-09523508', () => {
    const unsafeUrls = [
      'postgresql://owner:pass@ep-snowy-dream-09523508-production.us-east-2.aws.neon.tech/neondb?sslmode=require',
      'postgresql://owner:pass@ep-snowy-dream-09523508.us-east-2.aws.neon.tech/neondb?sslmode=require',
    ];

    for (const url of unsafeUrls) {
      assert.throws(
        () => assertSafeStagingDatabase(url, undefined),
        /targets the production branch/,
        `Should have rejected ${url}`
      );
    }
  });

  test('rejects hostnames with production indicators', () => {
    const unsafeUrl = 'postgresql://user:pass@production-db.internal.company.com:5432/crm_db?sslmode=require';
    assert.throws(
      () => assertSafeStagingDatabase(unsafeUrl, undefined),
      /indicates a production endpoint/
    );
  });

  test('allows verified isolated staging and test database URLs', () => {
    const safeUrls = [
      'postgresql://user:pass@ep-snowy-dream-09523508-staging.us-east-2.aws.neon.tech/neondb?sslmode=require',
      'postgresql://user:pass@ep-snowy-dream-09523508-test.us-east-2.aws.neon.tech/neondb?sslmode=require',
      'postgresql://user:pass@ep-staging-4567.us-east-2.aws.neon.tech/taskflow_staging?sslmode=require',
      'postgresql://postgres:postgres@localhost:5432/taskflow_test',
    ];

    const prodUrl = 'postgresql://admin:prodpass@ep-snowy-dream-09523508-production.us-east-2.aws.neon.tech/neondb?sslmode=require';

    for (const safeUrl of safeUrls) {
      assert.equal(assertSafeStagingDatabase(safeUrl, prodUrl), true, `Should have accepted ${safeUrl}`);
    }
  });
});
