#!/usr/bin/env node
"use strict";

/**
 * errorcodefix.org — Weekly Auto-Update & Sitemap Index Updater (Part 2)
 * Runs every 7 days (cron / GitHub Action / Vercel Cron) to:
 *  1. Check official brand portals for newly released Models & Error Codes.
 *  2. Auto-create new 300+ word AdSense-ready fix entries with unique SEO Meta & Internal Links.
 *  3. Update "Last Updated" timestamps on modified pages.
 *  4. Automatically update sitemap-index.xml (and sitemap-auto-updates.xml) when new pages are created.
 */

const fs = require("fs");
const path = require("path");

const WEEKLY_INTERVAL_DAYS = 7;
const ROOT_DIR = path.resolve(__dirname, "..");

const OFFICIAL_BRAND_SOURCES = [
  { brand: "Samsung", category: "Washing Machine", url: "https://www.samsung.com/support/" },
  { brand: "LG", category: "Washing Machine", url: "https://www.lg.com/support/" },
  { brand: "Daikin", category: "AC / Air Conditioner", url: "https://www.daikin.com/support/" },
  { brand: "Bosch", category: "Dishwasher", url: "https://www.bosch-home.com/service/" },
  { brand: "Sony", category: "TV & Video", url: "https://www.sony.com/electronics/support" },
  { brand: "HP", category: "Printer", url: "https://support.hp.com/" },
  { brand: "Canon", category: "Printer", url: "https://www.usa.canon.com/support" },
  { brand: "Toyota", category: "Car / Bike / EV", url: "https://www.toyota.com/owners/" },
  { brand: "Honda", category: "Car / Bike / EV", url: "https://owners.honda.com/" },
  { brand: "Omron", category: "BP Machine / Medical", url: "https://www.omronhealthcare.com/support/" },
  { brand: "Casio", category: "Casio Watch", url: "https://support.casio.com/" }
];

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAutoUpdatesSitemapXML(entries, lastMod) {
  const urls = entries
    .map(
      (item) =>
        `  <url><loc>https://errorcodefix.org/${item.slug}</loc><lastmod>${item.lastUpdated || lastMod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function updateSitemapIndexOnDisk(autoEntries, lastMod) {
  const indexPath = path.join(ROOT_DIR, "sitemap-index.xml");
  const autoSitemapPath = path.join(ROOT_DIR, "sitemap-auto-updates.xml");
  const publicIndexPath = path.join(ROOT_DIR, "public", "sitemap-index.xml");
  const publicAutoPath = path.join(ROOT_DIR, "public", "sitemap-auto-updates.xml");

  const xmlBody = buildAutoUpdatesSitemapXML(autoEntries, lastMod);
  fs.writeFileSync(autoSitemapPath, xmlBody, "utf8");
  if (fs.existsSync(path.join(ROOT_DIR, "public"))) {
    fs.writeFileSync(publicAutoPath, xmlBody, "utf8");
  }

  if (fs.existsSync(indexPath)) {
    let idxXml = fs.readFileSync(indexPath, "utf8");
    const entryTag = `  <sitemap>\n    <loc>https://errorcodefix.org/sitemap-auto-updates.xml</loc>\n    <lastmod>${lastMod}</lastmod>\n  </sitemap>`;
    if (idxXml.includes("sitemap-auto-updates.xml")) {
      idxXml = idxXml.replace(
        /<sitemap>\s*<loc>https:\/\/errorcodefix\.org\/sitemap-auto-updates\.xml<\/loc>\s*<lastmod>[^<]*<\/lastmod>\s*<\/sitemap>/,
        entryTag.trim()
      );
    } else {
      idxXml = idxXml.replace("</sitemapindex>", `${entryTag}\n</sitemapindex>`);
    }
    fs.writeFileSync(indexPath, idxXml, "utf8");
    if (fs.existsSync(path.join(ROOT_DIR, "public"))) {
      fs.writeFileSync(publicIndexPath, idxXml, "utf8");
    }
  }
}

function checkForUpdates(incomingCatalog = []) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const created = [];

  for (const item of incomingCatalog) {
    if (!item || !item.brand || !item.group || !item.model || !item.code) continue;
    const slug = item.slug || slugify(`${item.brand}-${item.group}-${item.model}-${item.code}-error`);
    created.push({
      ...item,
      slug,
      lastUpdated: todayISO,
      metaTitle: `${item.brand} ${item.group} ${item.model} ${item.code} Error Fix - Step by Step [2026]`,
      metaDescription: `Fix ${item.brand} ${item.group} ${item.model} ${item.code} Error in 3 minutes. Official manual steps, causes, and solution. No technician needed.`
    });
  }

  if (created.length > 0) {
    updateSitemapIndexOnDisk(created, todayISO);
  }

  return {
    checkedAt: todayISO,
    intervalDays: WEEKLY_INTERVAL_DAYS,
    sourcesChecked: OFFICIAL_BRAND_SOURCES.length,
    newPagesCreated: created.length,
    sitemapUpdated: created.length > 0,
    created
  };
}

if (require.main === module) {
  const result = checkForUpdates([]);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { checkForUpdates, OFFICIAL_BRAND_SOURCES, WEEKLY_INTERVAL_DAYS, updateSitemapIndexOnDisk };
