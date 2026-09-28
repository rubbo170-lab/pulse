// Endereços das páginas em cada idioma (o site em inglês e espanhol usa caminhos traduzidos).
export const PATHS = {
  pt: { home: '/', create: '/criar', order: '/pedido', videos: '/meus-videos', signin: '/entrar', reset: '/nova-senha', terms: '/termos', privacy: '/privacidade' },
  en: { home: '/en', create: '/en/create', order: '/en/order', videos: '/en/my-videos', signin: '/en/sign-in', reset: '/en/new-password', terms: '/en/terms', privacy: '/en/privacy' },
  es: { home: '/es', create: '/es/crear', order: '/es/pedido', videos: '/es/mis-videos', signin: '/es/entrar', reset: '/es/nueva-contrasena', terms: '/es/terminos', privacy: '/es/privacidad' },
};

// página (arquivo em views/) de cada rota
export const PAGE_FILES = { home: 'index.html', create: 'criar.html', videos: 'meus-videos.html', signin: 'entrar.html', reset: 'nova-senha.html', terms: 'termos.html', privacy: 'privacidade.html', order: 'pedido.html' };

// "/en/create" -> { lang: 'en', page: 'create' }; "/pedido/abc…" -> { lang: 'pt', page: 'order', id }
export function resolvePage(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const [lang, map] of Object.entries(PATHS)) {
    for (const [page, route] of Object.entries(map)) {
      if (page === 'order') {
        const m = new RegExp(`^${route}/([a-z0-9]{16})$`).exec(p);
        if (m) return { lang, page, id: m[1] };
      } else if (p === route) return { lang, page };
    }
  }
  return null;
}

export const langOfPath = (pathname) => (/^\/en(\/|$)/.test(pathname) ? 'en' : /^\/es(\/|$)/.test(pathname) ? 'es' : 'pt');
