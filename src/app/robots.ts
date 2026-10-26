import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // /api/stats is public documented data we actively want cited, so it is
      // carved out ahead of the blanket /api/ disallow (more specific allow
      // wins for Google and Bing alike).
      //
      // /api/og and /api/badge are images other pages embed: every profile,
      // Wrapped, blog and stats page's og:image is /api/og?…, and X and
      // LinkedIn fetch it with crawlers that honour this file. Disallowed,
      // they can skip the image, and a shared link goes out as bare text.
      allow: ['/', '/api/stats', '/api/og', '/api/badge'],
      disallow: ['/api/', '/private/'],
    },
    sitemap: 'https://www.viberank.app/sitemap.xml',
  }
}