'use strict';

/**
 * Run: node mobile/src/utils/__tests__/listingCatalogForm.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'listingCatalogForm.js')).href;
  const {
    catalogWatchStep1Issue,
    catalogWatchColorIssue,
    buildCatalogPayload,
  } = await import(moduleUrl);

  const gearSOptions = {
    sizes: [],
    connectivities: [{ id: 11, name_en: 'Bluetooth' }],
    storages: [{ id: 21, capacity_gb: 4 }],
    colors: [{ id: 31, name: 'Blue Black' }],
  };
  const series8Options = {
    sizes: [
      { id: 41, label: '41mm' },
      { id: 45, label: '45mm' },
    ],
    connectivities: [{ id: 12, name_en: 'GPS' }],
    storages: [{ id: 22, capacity_gb: 32 }],
    colors: [{ id: 32, name: 'Midnight' }],
  };
  const emptyAllOptions = {
    sizes: [],
    connectivities: [],
    storages: [],
    colors: [],
  };

  assert.equal(
    catalogWatchStep1Issue(
      {
        model_watch_case_size_id: '',
        model_watch_connectivity_id: 11,
        model_storage_id: 21,
      },
      gearSOptions
    ),
    null,
    'Gear S with no case sizes must not block Next'
  );

  assert.equal(
    catalogWatchStep1Issue(
      {
        model_watch_case_size_id: '',
        model_watch_connectivity_id: '',
        model_storage_id: 22,
      },
      series8Options
    ),
    'pleaseSelectCaseSize'
  );

  assert.equal(
    catalogWatchStep1Issue(
      {
        model_watch_case_size_id: 41,
        model_watch_connectivity_id: 12,
        model_storage_id: 22,
      },
      series8Options
    ),
    null
  );

  assert.equal(
    catalogWatchStep1Issue(
      {
        model_watch_case_size_id: 41,
        model_watch_connectivity_id: '',
        model_storage_id: 22,
      },
      series8Options
    ),
    'pleaseSelectConnectivity'
  );

  assert.equal(
    catalogWatchStep1Issue({}, emptyAllOptions),
    null,
    'zero options across all watch fields is not a validation failure'
  );

  assert.equal(
    catalogWatchColorIssue({ model_color_id: '' }, { colors: [] }),
    null
  );
  assert.equal(
    catalogWatchColorIssue({ model_color_id: '' }, { colors: [{ id: 32 }] }),
    'pleaseSelectColor'
  );
  assert.equal(
    catalogWatchColorIssue({ model_color_id: 32 }, { colors: [{ id: 32 }] }),
    null
  );

  const gearSPayload = buildCatalogPayload(
    {
      model_id: 80899,
      model_watch_case_size_id: '',
      model_watch_connectivity_id: 11,
      model_storage_id: 21,
      model_color_id: 31,
    },
    { isSmartwatch: true, watchOptions: gearSOptions }
  );
  assert.equal(gearSPayload.listing_source, 'catalog');
  assert.equal(gearSPayload.model_id, 80899);
  assert.equal('model_watch_case_size_id' in gearSPayload, false);
  assert.equal(gearSPayload.model_watch_connectivity_id, 11);
  assert.equal(gearSPayload.model_storage_id, 21);
  assert.equal(gearSPayload.model_color_id, 31);

  const series8Payload = buildCatalogPayload(
    {
      model_id: 1,
      model_watch_case_size_id: 41,
      model_watch_connectivity_id: 12,
      model_storage_id: 22,
      model_color_id: 32,
    },
    { isSmartwatch: true, watchOptions: series8Options }
  );
  assert.equal(series8Payload.model_watch_case_size_id, 41);

  console.log('listingCatalogForm watch optional attributes: cases passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
