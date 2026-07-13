/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export const BRAND_CONFIG = {
  brandName: '青鸟 API',
  brandNameEn: 'Qingniao API',
  siteTitle: '青鸟 API',
  browserTitle: '青鸟 API - AI API 聚合平台',
  description: 'AI API 聚合与分发平台',
  slogan: '统一接入，多模型聚合，灵活分发',
  logoPath: '/qingniao-logo.png',
  faviconPath: '/qingniao-favicon.ico',
  docsUrl: '/docs/',
  openSourceNotice:
    '本系统基于开源项目 New API 二次开发，遵循 AGPLv3 开源协议。',
};

export function resolveBrandLogoPath(logo) {
  const value = logo?.trim();
  if (!value) return BRAND_CONFIG.logoPath;

  let pathname = '';
  try {
    pathname = new URL(value, globalThis.location?.origin).pathname;
  } catch {
    pathname = value;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedPath = pathname.toLowerCase();
  const isLegacyLogo =
    normalizedPath === '/logo.png' ||
    normalizedPath.endsWith('/logo.png') ||
    normalizedValue.includes('newapi') ||
    normalizedValue.includes('new-api') ||
    normalizedValue.includes('quantumnous');

  return isLegacyLogo ? BRAND_CONFIG.logoPath : value;
}

export function resolveBrandDocsPath(docsUrl) {
  const value = docsUrl?.trim();
  if (!value) return BRAND_CONFIG.docsUrl;

  const normalized = value.toLowerCase();
  const isLegacyDocs =
    normalized.includes('docs.newapi') ||
    normalized.includes('newapi docs') ||
    normalized.includes('new api docs');

  return isLegacyDocs ? BRAND_CONFIG.docsUrl : value;
}
