/**
 * Database Safety Guard for Staging & Integration Testing
 *
 * Enforces strict isolation boundaries to ensure integration tests,
 * staging scripts, and experimental operations NEVER target or mutate
 * the production database.
 */

function parseUrlDetails(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { host: '', port: '', database: '', raw: '' };
  }
  try {
    const parsed = new URL(urlString.trim());
    return {
      host: (parsed.hostname || '').toLowerCase(),
      port: parsed.port || '5432',
      database: (parsed.pathname || '').replace(/^\//, '').toLowerCase(),
      searchParams: parsed.searchParams,
      raw: urlString.trim(),
    };
  } catch {
    // If URL parsing fails (e.g. malformed connection string)
    return { host: '', port: '', database: '', raw: urlString.trim() };
  }
}

/**
 * Validates that testDbUrl is an explicitly designated disposable staging database
 * and cannot accidentally migrate, seed, or modify production.
 *
 * Throws an Error with a descriptive message if unsafe.
 * Returns true if safe.
 */
function assertSafeStagingDatabase(testDbUrl, prodDbUrl = process.env.DATABASE_URL) {
  if (!testDbUrl || typeof testDbUrl !== 'string' || !testDbUrl.trim()) {
    throw new Error('SAFETY ABORT: TEST_DATABASE_URL is not configured.');
  }

  const trimmedTest = testDbUrl.trim();
  const testDetails = parseUrlDetails(trimmedTest);

  if (!testDetails.host && !trimmedTest.startsWith('postgres')) {
    throw new Error('SAFETY ABORT: TEST_DATABASE_URL is not a valid PostgreSQL connection URL.');
  }

  // 1. Direct equality check against DATABASE_URL
  if (prodDbUrl && typeof prodDbUrl === 'string' && prodDbUrl.trim()) {
    const trimmedProd = prodDbUrl.trim();
    if (trimmedTest === trimmedProd) {
      throw new Error(
        'SAFETY ABORT: TEST_DATABASE_URL is identical to DATABASE_URL. ' +
        'Integration tests must never execute against the primary application database.'
      );
    }

    const prodDetails = parseUrlDetails(trimmedProd);
    // Compare host and database name regardless of query parameters or user credentials
    if (
      testDetails.host &&
      prodDetails.host &&
      testDetails.host === prodDetails.host &&
      testDetails.database === prodDetails.database
    ) {
      throw new Error(
        `SAFETY ABORT: TEST_DATABASE_URL points to the same host (${testDetails.host}) and database (${testDetails.database}) as DATABASE_URL.`
      );
    }
  }

  // 2. Reject URLs targeting known production branches or endpoints
  const lowerUrl = trimmedTest.toLowerCase();
  const lowerHost = testDetails.host;
  const lowerDb = testDetails.database;

  // Specific check for snowy-dream-09523508 production branch and endpoint
  if (lowerUrl.includes('ep-icy-morning-b59bgelp')) {
    throw new Error(
      'SAFETY ABORT: TEST_DATABASE_URL targets the production endpoint (ep-icy-morning-b59bgelp) of project snowy-dream-09523508.'
    );
  }

  const isSnowyDreamProject = lowerUrl.includes('snowy-dream-09523508');
  if (isSnowyDreamProject) {
    const isExplicitStagingOrTest =
      lowerUrl.includes('staging') ||
      lowerUrl.includes('test') ||
      lowerUrl.includes('preview') ||
      lowerUrl.includes('dev');

    const isProductionBranch =
      lowerUrl.includes('production') ||
      (lowerUrl.includes('snowy-dream-09523508') && !isExplicitStagingOrTest);

    if (isProductionBranch) {
      throw new Error(
        'SAFETY ABORT: TEST_DATABASE_URL targets the production branch of Neon project snowy-dream-09523508. ' +
        'Create and target an isolated staging branch instead.'
      );
    }
  }

  // 3. Reject database names indicating production
  const productionDbNames = ['production', 'prod', 'taskflow_prod', 'taskflow_production', 'main'];
  if (productionDbNames.includes(lowerDb) || lowerDb.endsWith('_production') || lowerDb.endsWith('_prod')) {
    throw new Error(
      `SAFETY ABORT: Database name "${testDetails.database}" indicates a production database. Refusing to run tests.`
    );
  }

  // 4. Reject hostname indicating production
  if (lowerHost.includes('production') || lowerHost.includes('prod-db') || lowerHost.startsWith('prod.')) {
    throw new Error(
      `SAFETY ABORT: Hostname "${testDetails.host}" indicates a production endpoint. Refusing to run tests.`
    );
  }

  return true;
}

module.exports = {
  assertSafeStagingDatabase,
  parseUrlDetails,
};
