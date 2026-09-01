'use strict';

/**
 * Builds backend/database/smartwatch_attributes_seed.sql from researched records.
 * Run: node scripts/generateSmartwatchAttributesSql.js
 */
const fs = require('fs');
const path = require('path');

const records = [
  // ── Apple (18) ────────────────────────────────────────────
  { brand: 'Apple', model: 'Apple Watch', sizes: ['38mm', '42mm'], conns: ['bluetooth'], storage: [], colors: ['Silver||Stainless Steel', 'Space Black||Space Black Stainless Steel'], source: 'https://support.apple.com/en-us/112009' },
  { brand: 'Apple', model: 'Apple Watch Series 1', sizes: ['38mm', '42mm'], conns: ['bluetooth'], storage: [8], colors: [], source: 'https://support.apple.com/en-us/111985' },
  { brand: 'Apple', model: 'Apple Watch Series 2', sizes: ['38mm', '42mm'], conns: ['gps'], storage: [], colors: ['White||White Ceramic'], source: 'https://support.apple.com/en-us/112022' },
  { brand: 'Apple', model: 'Apple Watch Series 3', sizes: ['38mm', '42mm'], conns: ['gps', 'gps_cellular'], storage: [8, 16], colors: ['Silver||Aluminum Silver', 'Space Gray||Aluminum Space Gray', 'Gold||Aluminum Gold'], source: 'https://support.apple.com/en-us/111891' },
  { brand: 'Apple', model: 'Apple Watch Series 4', sizes: ['40mm', '44mm'], conns: ['gps', 'gps_cellular'], storage: [16], colors: ['Silver', 'Space Gray', 'Gold', 'Space Black||Space Black Stainless Steel'], source: 'https://support.apple.com/en-us/111984' },
  { brand: 'Apple', model: 'Apple Watch Series 5', sizes: ['40mm', '44mm'], conns: ['gps', 'gps_cellular'], storage: [32], colors: ['Silver', 'Space Gray', 'Gold', 'Space Black||Space Black Stainless Steel'], source: 'https://support.apple.com/en-us/118453' },
  { brand: 'Apple', model: 'Apple Watch Series 6', sizes: ['40mm', '44mm'], conns: ['gps', 'gps_cellular'], storage: [32], colors: ['Silver', 'Space Gray', 'Gold', 'Blue', '(PRODUCT)RED', 'Graphite', 'Natural Titanium||Titanium', 'Space Black||Space Black Titanium'], source: 'https://support.apple.com/en-us/111918' },
  { brand: 'Apple', model: 'Apple Watch Series 7', sizes: ['41mm', '45mm'], conns: ['gps', 'gps_cellular'], storage: [32], colors: ['Midnight', 'Starlight', 'Green', 'Blue', '(PRODUCT)RED', 'Graphite||Graphite (PVD)', 'Silver', 'Gold||Gold (PVD)', 'Space Black||Space Black Titanium', 'Natural Titanium||Titanium'], source: 'https://support.apple.com/en-us/111909' },
  { brand: 'Apple', model: 'Apple Watch Series 8', sizes: ['41mm', '45mm'], conns: ['gps', 'gps_cellular'], storage: [32], colors: ['Midnight', 'Starlight', 'Silver', '(PRODUCT)RED', 'Graphite||Graphite (PVD)', 'Gold||Gold (PVD)'], source: 'https://support.apple.com/en-us/111848' },
  { brand: 'Apple', model: 'Apple Watch Series 9', sizes: ['41mm', '45mm'], conns: ['gps', 'gps_cellular'], storage: [64], colors: ['Pink', 'Midnight', 'Starlight', 'Silver', '(PRODUCT)RED', 'Gold', 'Graphite'], source: 'https://support.apple.com/en-us/111833' },
  { brand: 'Apple', model: 'Apple Watch Series 10', sizes: ['42mm', '46mm'], conns: ['gps', 'gps_cellular'], storage: [64], colors: ['Jet Black', 'Rose Gold', 'Silver', 'Slate', 'Gold', 'Natural||Natural Titanium'], source: 'https://support.apple.com/en-us/121202' },
  { brand: 'Apple', model: 'Apple Watch Series 11', sizes: ['42mm', '46mm'], conns: ['gps', 'gps_cellular'], storage: [64], colors: ['Rose Gold', 'Silver', 'Space Gray', 'Jet Black', 'Gold', 'Natural||Natural Titanium', 'Slate'], source: 'https://support.apple.com/en-us/125093' },
  { brand: 'Apple', model: 'Apple Watch SE', sizes: ['40mm', '44mm'], conns: ['gps', 'gps_cellular'], storage: [32], colors: ['Silver', 'Space Gray', 'Gold'], source: 'https://support.apple.com/en-us/111862' },
  { brand: 'Apple', model: 'Apple Watch SE 2', sizes: ['40mm', '44mm'], conns: ['gps', 'gps_cellular'], storage: [32], colors: ['Midnight', 'Starlight', 'Silver'], source: 'https://support.apple.com/en-us/111853' },
  { brand: 'Apple', model: 'Apple Watch SE 3', sizes: ['40mm', '44mm'], conns: ['gps', 'gps_cellular'], storage: [64], colors: ['Jet Black', 'Rose Gold', 'Silver', 'Space Gray'], source: 'https://support.apple.com/en-us/125094' },
  { brand: 'Apple', model: 'Apple Watch Ultra', sizes: ['49mm'], conns: ['gps_cellular'], storage: [32], colors: ['Natural Titanium||Titanium'], source: 'https://support.apple.com/en-us/111852' },
  { brand: 'Apple', model: 'Apple Watch Ultra 2', sizes: ['49mm'], conns: ['gps_cellular'], storage: [64], colors: ['Natural||Natural Titanium', 'Black||Black Titanium'], source: 'https://support.apple.com/en-us/111832' },
  { brand: 'Apple', model: 'Apple Watch Ultra 3', sizes: ['49mm'], conns: ['gps_cellular'], storage: [64], colors: ['Natural||Natural Titanium', 'Black||Black Titanium'], source: 'https://support.apple.com/en-us/125095' },

  // ── Samsung (27) ──────────────────────────────────────────
  { brand: 'Samsung', model: 'Galaxy Gear', sizes: [], conns: ['bluetooth'], storage: [], colors: ['Jet Black', 'Mocha Gray', 'Wild Orange', 'Oatmeal Beige', 'Rose Gold', 'Lime Green'], source: 'https://news.samsung.com/global/introducing-galaxy-gear-a-wearable-device' },
  { brand: 'Samsung', model: 'Gear 2', sizes: [], conns: ['bluetooth'], storage: [4], colors: ['Charcoal Black', 'Gold Brown', 'Wild Orange'], source: 'https://news.samsung.com/global/first-look-samsung-gear-2-and-gear-2-neo' },
  { brand: 'Samsung', model: 'Gear 2 Neo', sizes: [], conns: ['bluetooth'], storage: [4], colors: ['Charcoal Black', 'Mocha Gray', 'Wild Orange'], source: 'https://news.samsung.com/global/first-look-samsung-gear-2-and-gear-2-neo' },
  { brand: 'Samsung', model: 'Gear S', sizes: [], conns: ['bluetooth'], storage: [4], colors: ['Blue Black', 'White'], source: 'https://news.samsung.com/global/what-does-gear-s-bring-to-the-table' },
  { brand: 'Samsung', model: 'Gear S2', sizes: [], conns: ['bluetooth'], storage: [4], colors: ['Dark Gray', 'Silver'], source: 'https://news.samsung.com/global/samsung-comes-full-circle-with-introduction-of-samsung-gear-s2' },
  { brand: 'Samsung', model: 'Gear S2 Classic', sizes: [], conns: ['bluetooth'], storage: [4], colors: ['Black', '18K Rose Gold', 'Platinum'], source: 'https://news.samsung.com/us/samsung-presents-gear-s2-classic-rose-gold-platinum' },
  { brand: 'Samsung', model: 'Gear S3', sizes: [], conns: ['bluetooth', 'bluetooth_lte'], storage: [4], colors: ['Dark Gray', 'Silver'], source: 'https://news.samsung.com/global/samsung-gear-s3-begins-global-rollout-with-debut-in-south-korea' },
  { brand: 'Samsung', model: 'Gear S3 Classic', sizes: [], conns: ['bluetooth', 'bluetooth_lte'], storage: [4], colors: ['Silver'], source: 'https://news.samsung.com/us/samsung-brings-enhanced-4g-lte-capability-gear-s3-classic' },
  { brand: 'Samsung', model: 'Gear S3 Frontier', sizes: [], conns: ['bluetooth', 'bluetooth_lte'], storage: [4], colors: ['Dark Gray'], source: 'https://news.samsung.com/global/samsung-gear-s3-begins-global-rollout-with-debut-in-south-korea' },
  { brand: 'Samsung', model: 'Gear Sport', sizes: [], conns: ['bluetooth'], storage: [4], colors: ['Black', 'Blue'], source: 'https://news.samsung.com/global/samsungs-new-enhanced-wearables-gear-sport-gear-fit2-pro-gear-icon-x-combine-the-best-in-smart-living-fitness-and-health' },
  { brand: 'Samsung', model: 'Galaxy Watch', sizes: ['42mm', '46mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [4], colors: ['Silver', 'Midnight Black', 'Rose Gold'], source: 'https://news.samsung.com/global/stay-connected-no-matter-where-you-are-with-the-new-samsung-galaxy-watch' },
  { brand: 'Samsung', model: 'Galaxy Watch Active', sizes: ['40mm'], conns: ['bluetooth'], storage: [4], colors: ['Silver', 'Black', 'Rose Gold', 'Sea Green'], source: 'https://news.samsung.com/global/samsung-introduces-three-new-wearables-for-balanced-and-connected-living' },
  { brand: 'Samsung', model: 'Galaxy Watch Active2', sizes: ['40mm', '44mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [4], colors: ['Cloud Silver', 'Aqua Black', 'Pink Gold', 'Silver', 'Black', 'Gold'], source: 'https://news.samsung.com/global/galaxy-watch-active2-designed-to-help-balance-wellness-with-upgraded-connectivity' },
  { brand: 'Samsung', model: 'Galaxy Watch3', sizes: ['41mm', '45mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [8], colors: ['Mystic Bronze', 'Mystic Black', 'Mystic Silver'], source: 'https://news.samsung.com/global/galaxy-watch3-and-galaxy-buds-live-now-available' },
  { brand: 'Samsung', model: 'Galaxy Watch4', sizes: ['40mm', '44mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [16], colors: ['Black', 'Green', 'Silver', 'Pink Gold'], source: 'https://news.samsung.com/global/galaxy-watch4-and-galaxy-watch4-classic-reshaping-the-smartwatch-experience' },
  { brand: 'Samsung', model: 'Galaxy Watch4 Classic', sizes: ['42mm', '46mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [16], colors: ['Black', 'Silver'], source: 'https://news.samsung.com/global/galaxy-watch4-and-galaxy-watch4-classic-reshaping-the-smartwatch-experience' },
  { brand: 'Samsung', model: 'Galaxy Watch5', sizes: ['40mm', '44mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [16], colors: ['Graphite', 'Sapphire', 'Silver', 'Pink Gold'], source: 'https://news.samsung.com/global/samsung-leads-holistic-health-innovation-with-galaxy-watch5-and-galaxy-watch5-pro' },
  { brand: 'Samsung', model: 'Galaxy Watch5 Pro', sizes: ['45mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [16], colors: ['Black Titanium', 'Gray Titanium'], source: 'https://news.samsung.com/global/samsung-leads-holistic-health-innovation-with-galaxy-watch5-and-galaxy-watch5-pro' },
  { brand: 'Samsung', model: 'Galaxy Watch6', sizes: ['40mm', '44mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [16], colors: ['Graphite', 'Silver', 'Gold'], source: 'https://news.samsung.com/global/samsung-galaxy-watch6-and-galaxy-watch6-classic-inspiring-your-best-self-day-and-night' },
  { brand: 'Samsung', model: 'Galaxy Watch6 Classic', sizes: ['43mm', '47mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [16], colors: ['Black', 'Silver'], source: 'https://news.samsung.com/global/samsung-galaxy-watch6-and-galaxy-watch6-classic-inspiring-your-best-self-day-and-night' },
  { brand: 'Samsung', model: 'Galaxy Watch FE', sizes: ['40mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [16], colors: ['Black', 'Pink Gold', 'Silver'], source: 'https://news.samsung.com/global/first-galaxy-watch-fe-empowers-even-more-users-with-samsungs-advanced-health-monitoring-technology' },
  { brand: 'Samsung', model: 'Galaxy Watch7', sizes: ['40mm', '44mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [32], colors: ['Green', 'Cream', 'Silver'], source: 'https://news.samsung.com/global/samsungs-expanded-wearables-portfolio-unlocks-intelligent-health-experiences-for-all' },
  { brand: 'Samsung', model: 'Galaxy Watch Ultra', sizes: ['47mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [32], colors: ['Titanium Silver', 'Titanium Gray', 'Titanium White'], source: 'https://news.samsung.com/global/samsungs-expanded-wearables-portfolio-unlocks-intelligent-health-experiences-for-all' },
  { brand: 'Samsung', model: 'Galaxy Watch8', sizes: ['40mm', '44mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [32], colors: ['Graphite', 'Silver'], source: 'https://news.samsung.com/global/samsung-galaxy-watch8-series-ultra-comfort-from-sleep-to-workout' },
  { brand: 'Samsung', model: 'Galaxy Watch8 Classic', sizes: ['46mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [64], colors: ['Black', 'White'], source: 'https://news.samsung.com/global/samsung-galaxy-watch8-series-ultra-comfort-from-sleep-to-workout' },
  { brand: 'Samsung', model: 'Galaxy Watch9', sizes: ['40mm', '44mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [32], colors: ['Graphite', 'Cream', 'Silver'], source: 'https://news.samsung.com/global/samsung-galaxy-watch-ultra2-and-watch9-your-health-companion-on-the-wrist' },
  { brand: 'Samsung', model: 'Galaxy Watch Ultra2', sizes: ['47mm'], conns: ['bluetooth', 'bluetooth_lte'], storage: [64], colors: ['Titanium Silver', 'Titanium Gray'], source: 'https://news.samsung.com/global/samsung-galaxy-watch-ultra2-and-watch9-your-health-companion-on-the-wrist' },

  // ── Huawei (38) ───────────────────────────────────────────
  { brand: 'Huawei', model: 'HUAWEI WATCH', sizes: ['42mm'], conns: ['bluetooth'], storage: [4], colors: ['Stainless Steel', 'Space Black||Black-plated Stainless Steel', 'Rose Gold||Rose gold-plated Stainless Steel'], source: 'https://consumer.huawei.com/sa-en/wearables/watch/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH 2', sizes: [], conns: ['gps', 'gps_cellular'], storage: [4], colors: ['Carbon Crystal Black'], source: 'https://consumer.huawei.com/hk/wearables/watch2/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH 2 Classic', sizes: [], conns: [], storage: [], colors: [], source: 'https://consumer.huawei.com/hk/wearables/watch2/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH 3', sizes: ['46mm'], conns: ['gps', 'gps_cellular'], storage: [16], colors: [], source: 'https://consumer.huawei.com/hu/wearables/watch-3-series/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH 3 Pro', sizes: ['48mm'], conns: ['gps', 'gps_cellular'], storage: [16], colors: ['Brown', 'Silver'], source: 'https://consumer.huawei.com/es/wearables/watch-3-pro/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH 4', sizes: [], conns: ['gps', 'gps_cellular'], storage: [], colors: ['Black'], source: 'https://consumer.huawei.com/uk/wearables/watch-4-series/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH 4 Pro', sizes: [], conns: ['gps', 'gps_cellular'], storage: [], colors: [], source: 'https://consumer.huawei.com/uk/wearables/watch-4-series/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH 5', sizes: ['42mm', '46mm'], conns: ['gps', 'gps_cellular'], storage: [], colors: ['Purple', 'Silver', 'Brown', 'Blue', 'Black', 'Beige', 'Sand Gold', 'White', 'Green'], source: 'https://consumer.huawei.com/en/wearables/watch-5/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT', sizes: ['42mm', '46mm'], conns: ['gps'], storage: [], colors: ['Black||Black Stainless Steel', 'Silver||Stainless Steel', 'Gray||Titanium Grey Stainless Steel'], source: 'https://consumer.huawei.com/sa-en/wearables/watch-gt/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 2', sizes: ['42mm', '46mm'], conns: ['gps'], storage: [], colors: ['Black||Black Stainless Steel', 'Silver||Stainless Steel', 'Gray||Titanium Grey Stainless Steel', 'Rose Gold||Rose Gold Stainless Steel'], source: 'https://consumer.huawei.com/ca/wearables/watch-gt2/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 2e', sizes: [], conns: ['gps'], storage: [4], colors: ['Black||Black Stainless Steel', 'Silver||Stainless Steel'], source: 'https://consumer.huawei.com/latin/wearables/watch-gt-2e/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 2 Pro', sizes: [], conns: ['gps'], storage: [4], colors: ['Night Black', 'Nebula Gray'], source: 'https://consumer.huawei.com/ie/wearables/watch-gt2-pro/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 3', sizes: ['42mm', '46mm'], conns: ['gps'], storage: [4], colors: ['Black', 'Silver||Steel', 'Gold'], source: 'https://consumer.huawei.com/ca/wearables/watch-gt3/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 3 SE', sizes: ['46mm'], conns: ['gps'], storage: [], colors: ['Graphite||Graphite Black', 'Green||Wilderness Green'], source: 'https://consumer.huawei.com/cl/offer/huawei-health/watch-gt3-se/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 3 Pro', sizes: ['43mm', '46mm'], conns: ['gps'], storage: [], colors: ['White||White Ceramic', 'Black||Black Fluoroelastomer', 'Gray||Gray Leather', 'Natural Titanium||Titanium'], source: 'https://consumer.huawei.com/ca/wearables/watch-gt3-pro-titanium/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT Runner', sizes: ['46mm'], conns: ['gps'], storage: [], colors: ['Gray||Grey'], source: 'https://consumer.huawei.com/sg/wearables/watch-gt-runner/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT Runner 2', sizes: [], conns: ['gps'], storage: [], colors: ['Dusk Blue', 'Dawn Orange', 'Midnight Black'], source: 'https://consumer.huawei.com/sg/wearables/watch-gt-runner-2/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT Cyber', sizes: [], conns: ['gps'], storage: [], colors: ['Midnight Black', 'Space Gray||Space Grey', 'Sunrise Yellow'], source: 'https://consumer.huawei.com/cl/offer/wearable/watch-gt-cyber/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 4', sizes: ['41mm', '46mm'], conns: ['gps'], storage: [], colors: [], source: 'https://consumer.huawei.com/ca/wearables/watch-gt4/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 5', sizes: ['41mm', '46mm'], conns: ['gps'], storage: [], colors: [], source: 'https://consumer.huawei.com/en/wearables/watch-gt5/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 5 Pro', sizes: ['42mm', '46mm'], conns: ['gps'], storage: [], colors: ['Black', 'White'], source: 'https://consumer.huawei.com/en/wearables/watch-gt5-pro/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 6', sizes: ['41mm', '46mm'], conns: ['gps'], storage: [], colors: [], source: 'https://consumer.huawei.com/uk/wearables/watch-gt6/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH GT 6 Pro', sizes: [], conns: ['gps'], storage: [], colors: ['Black', 'Brown', 'Natural Titanium||Titanium'], source: 'https://consumer.huawei.com/sg/wearables/watch-gt6-pro/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH Ultimate', sizes: [], conns: ['gps'], storage: [], colors: ['Green||Green edition', 'Blue||Blue edition', 'Black||Black edition'], source: 'https://consumer.huawei.com/uk/wearables/watch-ultimate/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH Ultimate Design', sizes: [], conns: ['gps'], storage: [], colors: [], source: 'https://consumer.huawei.com/kw-en/wearables/watch-ultimate-design/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH Ultimate 2', sizes: [], conns: ['gps', 'gps_cellular'], storage: [], colors: ['Black', 'Blue', 'Green'], source: 'https://consumer.huawei.com/uk/wearables/watch-ultimate-2/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT', sizes: [], conns: ['gps'], storage: [4], colors: ['Graphite||Graphite Black', 'Mint', 'Melon', 'Sakura'], source: 'https://consumer.huawei.com/co/wearables/watch-fit/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT 2', sizes: [], conns: ['bluetooth'], storage: [], colors: ['Midnight Black', 'Sakura Pink', 'Isle Blue', 'Nebula Gray', 'Moon White'], source: 'https://consumer.huawei.com/ca/wearables/watch-fit2/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT SE', sizes: [], conns: ['gps'], storage: [], colors: ['Starry Black', 'Nebula Pink', 'Forest Green'], source: 'https://consumer.huawei.com/ph/wearables/watch-fit-special-edition/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT 3', sizes: [], conns: ['gps'], storage: [], colors: ['White', 'Gray||Grey', 'Green', 'Pink', 'Black'], source: 'https://consumer.huawei.com/uk/wearables/watch-fit3/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT 4', sizes: [], conns: ['gps'], storage: [], colors: ['Purple', 'Gray||Grey', 'White', 'Black'], source: 'https://consumer.huawei.com/en/wearables/watch-fit4/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT 4 Pro', sizes: [], conns: ['gps'], storage: [], colors: ['Green', 'Blue', 'Black'], source: 'https://consumer.huawei.com/en/wearables/watch-fit4-pro/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT 5', sizes: [], conns: ['gps'], storage: [64], colors: ['Silver', 'Purple', 'Green', 'White', 'Black'], source: 'https://consumer.huawei.com/uk/wearables/watch-fit5/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH FIT 5 Pro', sizes: [], conns: ['gps'], storage: [64], colors: ['Orange', 'White', 'Black'], source: 'https://consumer.huawei.com/uk/wearables/watch-fit5-pro/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH D', sizes: [], conns: ['gps'], storage: [], colors: ['Graphite||Graphite Black'], source: 'https://consumer.huawei.com/lk/wearables/watch-d/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH D2', sizes: [], conns: ['gps'], storage: [], colors: ['Blue', 'Black', 'Gold'], source: 'https://consumer.huawei.com/en/wearables/watch-d2/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH Buds', sizes: [], conns: ['gps'], storage: [], colors: ['Black', 'Khaki'], source: 'https://consumer.huawei.com/ca/wearables/watch-buds/specs/' },
  { brand: 'Huawei', model: 'HUAWEI WATCH Buds 2', sizes: [], conns: ['gps'], storage: [], colors: ['Black', 'Brown'], source: 'https://consumer.huawei.com/en/wearables/watch-buds-2/specs/' },
];

const extraColors = {
  '(PRODUCT)RED': '#C41E3A',
  'Space Black': '#1A1A1A',
  Slate: '#4A4E57',
  Natural: '#C4B8A8',
  'Rose Gold': '#E6B8A2',
  'Pink Gold': '#E8B4A2',
  'Titanium Silver': '#C0C4C8',
  'Titanium Gray': '#6B6E73',
  'Titanium White': '#F2F0EA',
  'Mystic Bronze': '#8B6B3D',
  'Mystic Black': '#1A1A1A',
  'Mystic Silver': '#C8C8C8',
  'Cloud Silver': '#D4D8DC',
  'Aqua Black': '#1C2428',
  'Sea Green': '#2E8B6E',
  'Midnight Black': '#0D0D0F',
  'Dark Gray': '#4A4A4A',
  'Charcoal Black': '#2B2B2B',
  'Gold Brown': '#8A6A3A',
  'Wild Orange': '#E85D04',
  'Mocha Gray': '#6B5E54',
  'Oatmeal Beige': '#D8CDB8',
  'Lime Green': '#8FBF3F',
  'Blue Black': '#12141C',
  '18K Rose Gold': '#B76E79',
  Platinum: '#E5E4E2',
  Sapphire: '#2E5090',
  'Gray Titanium': '#6B6E73',
  Cream: '#F4EDD4',
  Orange: '#E85D04',
  Khaki: '#8B7D4A',
  Beige: '#D4C4A8',
  'Sand Gold': '#C4A574',
  Brown: '#6B4423',
  'Stainless Steel': '#C0C0C0',
  'Carbon Crystal Black': '#111111',
  'Night Black': '#0A0A0A',
  'Nebula Gray': '#6A6E76',
  'Dusk Blue': '#3D5A80',
  'Dawn Orange': '#E07A3D',
  'Sunrise Yellow': '#F4C430',
  'Black Titanium': '#2A2A2A',
  Mint: '#98D4B4',
  Melon: '#F4A07A',
  Sakura: '#F4B8C8',
  'Sakura Pink': '#F4B8C8',
  'Isle Blue': '#5B8FA8',
  'Moon White': '#F7F5F0',
  'Starry Black': '#141418',
  'Nebula Pink': '#D48AA8',
  'Forest Green': '#2F5D3A',
};

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTextArray(arr) {
  if (!arr.length) return `'{}'::text[]`;
  return `ARRAY[${arr.map(sqlStr).join(', ')}]::text[]`;
}

function sqlIntArray(arr) {
  if (!arr.length) return `'{}'::int[]`;
  return `ARRAY[${arr.join(', ')}]::int[]`;
}

const sizeMm = {
  '38mm': '38.0', '40mm': '40.0', '41mm': '41.0', '42mm': '42.0', '43mm': '43.0',
  '44mm': '44.0', '45mm': '45.0', '46mm': '46.0', '47mm': '47.0', '48mm': '48.0',
  '49mm': '49.0',
};

const allSizes = [...new Set(records.flatMap((r) => r.sizes))];
const allColorNames = [...new Set(records.flatMap((r) => r.colors.map((c) => c.split('||')[0])))];

let sql = `-- ============================================================
-- Phase 2C — Real smartwatch catalog attributes
--
-- Idempotent. Resolves models by brand + name + smartwatches category.
-- Deactivates placeholder watch storage/color associations that are not
-- manufacturer-backed. Does NOT delete rows. Does NOT touch phone data.
-- ============================================================

BEGIN;

INSERT INTO storage_capacities (capacity_gb, label) VALUES
    (4, '4 GB'),
    (8, '8 GB')
ON CONFLICT (capacity_gb) DO NOTHING;

`;

allSizes.sort((a, b) => parseFloat(a) - parseFloat(b)).forEach((label, i) => {
  sql += `INSERT INTO watch_case_sizes (size_mm, label, sort_order)
VALUES (${sizeMm[label]}, ${sqlStr(label)}, ${i})
ON CONFLICT (label) DO UPDATE SET size_mm = EXCLUDED.size_mm, sort_order = EXCLUDED.sort_order;\n`;
});

sql += `\n`;

for (const name of allColorNames.sort()) {
  const hex = extraColors[name] || '#808080';
  sql += `INSERT INTO colors (name, hex_code) VALUES (${sqlStr(name)}, ${sqlStr(hex)})
ON CONFLICT (name) DO NOTHING;\n`;
}

sql += `
CREATE OR REPLACE FUNCTION telefonak_seed_watch_model(
    p_brand TEXT,
    p_model TEXT,
    p_sizes TEXT[],
    p_conns TEXT[],
    p_storage_gb INT[],
    p_color_specs TEXT[]
) RETURNS VOID AS $$
DECLARE
    v_model_id INTEGER;
    v_size TEXT;
    v_conn TEXT;
    v_gb INTEGER;
    v_spec TEXT;
    v_color_name TEXT;
    v_official TEXT;
    v_ord INTEGER;
    v_keep_color_ids INTEGER[] := '{}';
    v_keep_storage_ids INTEGER[] := '{}';
    v_color_id INTEGER;
    v_ms_id INTEGER;
BEGIN
    SELECT m.id INTO v_model_id
    FROM models m
    JOIN brands b ON b.id = m.brand_id
    JOIN categories c ON c.id = m.category_id
    WHERE b.name = p_brand
      AND m.name = p_model
      AND c.slug = 'smartwatches';

    IF v_model_id IS NULL THEN
        RAISE EXCEPTION 'Missing smartwatch model: % / %', p_brand, p_model;
    END IF;

    v_ord := 0;
    FOREACH v_size IN ARRAY COALESCE(p_sizes, '{}'::text[]) LOOP
        INSERT INTO model_watch_case_sizes (model_id, case_size_id, is_active, sort_order)
        SELECT v_model_id, wcs.id, TRUE, v_ord
        FROM watch_case_sizes wcs
        WHERE wcs.label = v_size
        ON CONFLICT (model_id, case_size_id) DO UPDATE
            SET is_active = TRUE, sort_order = EXCLUDED.sort_order;
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_watch_case_sizes mwcs
       SET is_active = FALSE
     WHERE mwcs.model_id = v_model_id
       AND NOT EXISTS (
           SELECT 1
           FROM unnest(COALESCE(p_sizes, '{}'::text[])) AS wanted(label)
           JOIN watch_case_sizes wcs ON wcs.label = wanted.label
           WHERE wcs.id = mwcs.case_size_id
       );

    v_ord := 0;
    FOREACH v_conn IN ARRAY COALESCE(p_conns, '{}'::text[]) LOOP
        INSERT INTO model_watch_connectivities (model_id, connectivity_id, is_active, sort_order)
        SELECT v_model_id, wc.id, TRUE, v_ord
        FROM watch_connectivities wc
        WHERE wc.slug = v_conn
        ON CONFLICT (model_id, connectivity_id) DO UPDATE
            SET is_active = TRUE, sort_order = EXCLUDED.sort_order;
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_watch_connectivities mwc
       SET is_active = FALSE
     WHERE mwc.model_id = v_model_id
       AND NOT EXISTS (
           SELECT 1
           FROM unnest(COALESCE(p_conns, '{}'::text[])) AS wanted(slug)
           JOIN watch_connectivities wc ON wc.slug = wanted.slug
           WHERE wc.id = mwc.connectivity_id
       );

    v_ord := 0;
    FOREACH v_gb IN ARRAY COALESCE(p_storage_gb, '{}'::int[]) LOOP
        INSERT INTO model_storages (model_id, storage_capacity_id, is_active, sort_order)
        SELECT v_model_id, sc.id, TRUE, v_ord
        FROM storage_capacities sc
        WHERE sc.capacity_gb = v_gb
        ON CONFLICT (model_id, storage_capacity_id) DO UPDATE
            SET is_active = TRUE, sort_order = EXCLUDED.sort_order;
        SELECT ms.id INTO v_ms_id
        FROM model_storages ms
        JOIN storage_capacities sc ON sc.id = ms.storage_capacity_id
        WHERE ms.model_id = v_model_id
          AND sc.capacity_gb = v_gb;
        v_keep_storage_ids := array_append(v_keep_storage_ids, v_ms_id);
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_storages
       SET is_active = FALSE
     WHERE model_id = v_model_id
       AND NOT (id = ANY (v_keep_storage_ids));

    v_ord := 0;
    FOREACH v_spec IN ARRAY COALESCE(p_color_specs, '{}'::text[]) LOOP
        IF position('||' IN v_spec) > 0 THEN
            v_color_name := split_part(v_spec, '||', 1);
            v_official := split_part(v_spec, '||', 2);
        ELSE
            v_color_name := v_spec;
            v_official := v_spec;
        END IF;

        SELECT id INTO v_color_id FROM colors WHERE name = v_color_name;
        IF v_color_id IS NULL THEN
            RAISE EXCEPTION 'Missing color catalog row: %', v_color_name;
        END IF;

        INSERT INTO model_colors (model_id, color_id, official_name, is_active, sort_order)
        VALUES (v_model_id, v_color_id, v_official, TRUE, v_ord)
        ON CONFLICT (model_id, color_id) DO UPDATE
            SET is_active = TRUE,
                official_name = EXCLUDED.official_name,
                sort_order = EXCLUDED.sort_order;
        SELECT mc.id INTO v_ms_id
        FROM model_colors mc
        WHERE mc.model_id = v_model_id
          AND mc.color_id = v_color_id;
        v_keep_color_ids := array_append(v_keep_color_ids, v_ms_id);
        v_ord := v_ord + 1;
    END LOOP;

    UPDATE model_colors
       SET is_active = FALSE
     WHERE model_id = v_model_id
       AND NOT (id = ANY (v_keep_color_ids));
END;
$$ LANGUAGE plpgsql;

`;

for (const rec of records) {
  sql += `SELECT telefonak_seed_watch_model(\n`;
  sql += `    ${sqlStr(rec.brand)},\n`;
  sql += `    ${sqlStr(rec.model)},\n`;
  sql += `    ${sqlTextArray(rec.sizes)},\n`;
  sql += `    ${sqlTextArray(rec.conns)},\n`;
  sql += `    ${sqlIntArray(rec.storage)},\n`;
  sql += `    ${sqlTextArray(rec.colors)}\n`;
  sql += `);\n\n`;
}

sql += `DROP FUNCTION telefonak_seed_watch_model(TEXT, TEXT, TEXT[], TEXT[], INT[], TEXT[]);

COMMIT;
`;

const CONN_LABEL = {
  gps: 'GPS',
  gps_cellular: 'GPS + Cellular',
  bluetooth: 'Bluetooth',
  bluetooth_lte: 'Bluetooth + LTE',
  lte: 'LTE',
};

function dash(items) {
  return items.length ? items.join(', ') : 'Not verified from official manufacturer documentation';
}

function storageLabel(gbs) {
  if (!gbs.length) return 'Not verified from official manufacturer documentation';
  return gbs.map((gb) => `${gb} GB`).join(', ');
}

function colorLabel(colors) {
  if (!colors.length) return 'Not verified from official manufacturer documentation';
  return colors
    .map((spec) => {
      const [name, official] = spec.split('||');
      return official && official !== name ? `${official}` : name;
    })
    .join(', ');
}

function notesFor(rec) {
  const notes = [];
  if (!rec.sizes.length) {
    notes.push('Case size: Not verified from official manufacturer documentation as a marketed millimetre SKU. No size attached.');
  }
  if (!rec.conns.length) {
    notes.push('Connectivity: Not verified from official manufacturer documentation. No connectivity attached.');
  }
  if (!rec.storage.length) {
    notes.push('Storage: Official manufacturer documentation does not establish a meaningful internal-storage marketplace option. No storage attached.');
  }
  if (!rec.colors.length) {
    notes.push('Colors/finishes: Not verified from official manufacturer documentation. Placeholder colors deactivated.');
  }
  if (rec.model === 'HUAWEI WATCH 2 Classic') {
    notes.push('No dedicated official Classic specs page was found. The WATCH 2 specs page covers WATCH 2 / Porsche Design, not Classic. All attributes left unassociated.');
  }
  if (rec.model === 'Gear S') {
    notes.push('Gear S had 3G cellular; that is not mapped to bluetooth_lte (LTE). Only Bluetooth is attached.');
  }
  if (['Gear S2', 'Gear S2 Classic'].includes(rec.model)) {
    notes.push('3G eSIM variants existed; they are not mapped to bluetooth_lte because the manufacturer did not market LTE.');
  }
  if (rec.model.startsWith('HUAWEI WATCH FIT 5')) {
    notes.push('64 GB appears on the official UK product pages; it is not always repeated in the compact specs table.');
  }
  return notes;
}

let md = `# Smartwatch attribute sources (Phase 2C)

Manufacturer-verified case size, connectivity, storage, and finish data for the existing 83 Apple / Samsung / Huawei smartwatch models.

Existing model names and IDs are unchanged. Phone catalog data is unchanged.

## Connectivity mapping

| Manufacturer term | Catalog slug |
| --- | --- |
| Apple GPS | \`gps\` |
| Apple GPS + Cellular | \`gps_cellular\` |
| Apple Watch (1st generation) / Series 1 (no GPS) | \`bluetooth\` |
| Samsung Bluetooth | \`bluetooth\` |
| Samsung Bluetooth + LTE | \`bluetooth_lte\` |
| Huawei GPS (no eSIM) | \`gps\` |
| Huawei GPS + eSIM / cellular | \`gps\` + \`gps_cellular\` |

No new connectivity vocabulary was added. Gear S 3G is **not** mapped to \`bluetooth_lte\`.

## Models

`;

for (const rec of records) {
  const notes = notesFor(rec);
  md += `### ${rec.brand} — ${rec.model}\n\n`;
  md += `- **Sizes:** ${dash(rec.sizes)}\n`;
  md += `- **Connectivity:** ${rec.conns.length ? rec.conns.map((c) => CONN_LABEL[c] || c).join(', ') : 'Not verified from official manufacturer documentation'}\n`;
  md += `- **Storage:** ${storageLabel(rec.storage)}\n`;
  md += `- **Colors/finishes:** ${colorLabel(rec.colors)}\n`;
  md += `- **Official source:** ${rec.source}\n`;
  if (notes.length) {
    md += `- **Notes:** ${notes.join(' ')}\n`;
  }
  md += `\n`;
}

md += `## Unverified attributes (left unassociated)

Attributes below were **not** invented. Placeholder 16/32/64 GB and Black/Silver/Gold/White rows for these models were deactivated where they were not official.

### No marketed millimetre case size

Samsung Gear family (Galaxy Gear through Gear Sport) was not sold as named mm SKUs on official newsroom spec tables. Huawei rectangular / capsule models (FIT, D, Buds) and several WATCH / Ultimate pages similarly do not market a millimetre case-size SKU.

### No connectivity attached

- **HUAWEI WATCH 2 Classic** — no dedicated official Classic specs page. The WATCH 2 specs page covers WATCH 2 / Porsche Design, not Classic.

### No storage attached

Storage was omitted wherever official manufacturer documentation does not list a meaningful internal-capacity marketplace option (typical for many Huawei GT/FIT/Ultimate models and Apple Watch 1st generation / Series 2).

### No finishes attached

- Apple Watch Series 1
- HUAWEI WATCH 3
- HUAWEI WATCH 4 Pro
- HUAWEI WATCH GT 4 / GT 5 / GT 6 (official pages list strap SKUs, not distinct case finishes)
- HUAWEI WATCH Ultimate Design
- HUAWEI WATCH 2 Classic
`;

const sqlOut = path.join(__dirname, '../database/smartwatch_attributes_seed.sql');
const mdOut = path.join(__dirname, '../database/SMARTWATCH_ATTRIBUTE_SOURCES.md');
fs.writeFileSync(sqlOut, sql);
fs.writeFileSync(mdOut, md);
console.log(`Wrote ${sqlOut} and ${mdOut} (${records.length} models)`);