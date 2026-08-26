'use strict';

const { rollbackArticleCatalogSageV1 } = require('../server');

try {
  const restored = rollbackArticleCatalogSageV1({ exportFile: process.env.PLANIFY_ARTICLE_CATALOG_RECOVERY_FILE });
  process.stdout.write(restored
    ? `Catalogue articles SAGE restauré. Export de récupération : ${restored.exportFile}\n`
    : 'Aucune migration catalogue articles SAGE à restaurer.\n');
} catch (error) {
  process.stderr.write(`Rollback catalogue articles impossible : ${error.message}\n`);
  process.exitCode = 1;
}
