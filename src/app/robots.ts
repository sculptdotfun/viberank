import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // /api/stats is public documented data we actively want cited, so it is
      // carved out ahead of the blanket /api/ disallow (more specific allow
      // wins for Google and Bing alike).
      allow: ['/', '/api/stats'],
      disallow: ['/api/', '/private/'],
    },
    sitemap: 'https://www.viberank.app/sitemap.xml',
  }
}