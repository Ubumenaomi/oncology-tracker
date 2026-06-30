import { getCriteriaFromSearchParams, rankNotionNewsItems } from '../src/data/notionNewsMatching.js';

const DEFAULT_DATA_SOURCE_ID = '105bb19a-c0c2-8160-aaab-000b49de9e79';
const DEFAULT_NOTION_VERSION = '2025-09-03';

function textFromRichText(parts = []) {
  return (parts || []).map((part) => part?.plain_text || '').join('');
}

function propMultiSelect(prop) {
  return (prop?.multi_select || []).map((item) => item.name).filter(Boolean);
}

function propTitle(prop) {
  return textFromRichText(prop?.title || []);
}

function propText(prop) {
  if (!prop) return '';
  if (prop.rich_text) return textFromRichText(prop.rich_text);
  if (prop.plain_text) return prop.plain_text;
  if (typeof prop === 'string') return prop;
  return '';
}

function normalizeNotionPage(page) {
  const properties = page?.properties || {};
  const title = propTitle(properties.Page) || propTitle(properties.Name) || page?.id || 'Untitled';
  const createdTime = page?.created_time || page?.createdTime || null;
  const item = {
    id: page.id,
    title,
    url: page.url,
    publishedAt: createdTime,
    createdTime,
    source: 'Notion · Fellow training',
    cancerTypes: propMultiSelect(properties['Cancer type']),
    subtypes: propMultiSelect(properties.subtype),
    tags: propMultiSelect(properties.tag),
    treatments: propMultiSelect(properties['治療']),
    drugs: propText(properties.drug).split(',').map((value) => value.trim()).filter(Boolean),
    genes: propMultiSelect(properties['Gene tag']),
    nccn: propText(properties.NCCN) || null,
  };
  return item;
}

function buildNotionFilter(criteria) {
  const filters = [];
  (criteria.cancerTypes || []).forEach((value) => {
    filters.push({ property: 'Cancer type', multi_select: { contains: value } });
  });
  (criteria.tags || []).forEach((value) => {
    filters.push({ property: 'tag', multi_select: { contains: value } });
  });
  (criteria.treatments || []).forEach((value) => {
    filters.push({ property: '治療', multi_select: { contains: value } });
  });
  (criteria.drugs || []).forEach((value) => {
    filters.push({ property: 'drug', rich_text: { contains: value } });
  });

  if (!filters.length) return undefined;
  if (filters.length === 1) return filters[0];
  return { or: filters };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    sendJson(res, 503, { error: 'missing_notion_token', message: 'NOTION_TOKEN is not configured.' });
    return;
  }

  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID;
  const notionVersion = process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION;
  const requestUrl = new URL(req.url, 'http://localhost');
  const day = Number(requestUrl.searchParams.get('day') || 0) || null;
  const criteria = getCriteriaFromSearchParams(requestUrl.searchParams);
  const filter = buildNotionFilter(criteria);
  const body = {
    page_size: 100,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    ...(filter ? { filter } : {}),
  };

  try {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'notion-version': notionVersion,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      sendJson(res, response.status, {
        error: 'notion_query_failed',
        code: payload.code || null,
        message: payload.message || 'Notion query failed.',
      });
      return;
    }

    const rawItems = (payload.results || []).map(normalizeNotionPage);
    const items = rankNotionNewsItems(rawItems, criteria);
    sendJson(res, 200, {
      day,
      criteria,
      items,
      fetchedAt: new Date().toISOString(),
      source: 'live',
    });
  } catch (error) {
    sendJson(res, 502, {
      error: 'notion_request_failed',
      message: error.message || 'Unable to reach Notion.',
    });
  }
}
