export const brand = { name: 'Bansa', tagline: 'Restaurant OS' } as const;

export const brandConfig = {
  name: brand.name,
  tagline: brand.tagline,
  description: 'A modern restaurant operating system for orders, inventory, and payments.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ogImage: '/og-image.png',
} as const;
