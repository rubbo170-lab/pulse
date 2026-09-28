'use strict';
// Editor: formulário → prévia animada (com marca PRÉVIA) → compra ou correção. Português, inglês e espanhol.
(() => {
  const $ = (id) => document.getElementById(id);
  const SEGMENTS = ['Confeitaria', 'Restaurante', 'Pizzaria', 'Lanchonete', 'Cafeteria', 'Moda', 'Beleza', 'Saúde', 'Odontologia', 'Fitness', 'Educação', 'Pet', 'Imobiliária', 'Serviços', 'Tecnologia', 'Loja', 'Outro'];
  const ICON_LABELS = { check: 'Visto', clock: 'Relógio', truck: 'Entrega', chat: 'Conversa', star: 'Estrela', heart: 'Coração', shield: 'Escudo', bolt: 'Raio', tag: 'Etiqueta', gift: 'Presente', leaf: 'Folha', pin: 'Local', phone: 'Celular', card: 'Cartão', calendar: 'Agenda', people: 'Pessoas', sparkle: 'Brilho', flame: 'Fogo', home: 'Casa', cart: 'Carrinho', globe: 'Internet', percent: 'Desconto', trophy: 'Troféu', smile: 'Sorriso', tool: 'Ferramenta', bag: 'Sacola', paw: 'Patinha', book: 'Livro', dumbbell: 'Treino', scissors: 'Tesoura', coffee: 'Café' };
  const SCENES = ['Gancho', 'Problema', 'Busca', 'Revelação', 'Vantagens', 'Prova', 'Contato', 'Marca'];
  const TEXT_IDS = ['f_name', 'f_segment', 'f_sells', 'f_diffs', 'f_offer', 'f_whats', 'f_insta', 'f_site', 'f_addr', 'f_rating', 'f_ratingSrc', 'f_customers', 'f_customersLabel', 'f_c1', 'f_c2',
    'f_hook1', 'f_hook2', 'f_pain', 'f_search', 'f_product', 'f_benTitle', 'f_b1', 'f_i1', 'f_b2', 'f_i2', 'f_b3', 'f_i3', 'f_b4', 'f_i4', 'f_tagline', 'f_cta'];

  // empresa fictícia de exemplo, uma por idioma
  const EXAMPLES = {
    pt: {
      f_name: 'Doce Aurora', f_segment: 'Confeitaria', f_sells: 'Bolos de pote, bolos de festa e doces finos por encomenda, para quem mora na região central.',
      f_diffs: 'Feito no mesmo dia\nEntrega no bairro\nPedido pelo WhatsApp', f_offer: '10% OFF no 1º pedido', f_whats: '(11) 90000-0000', f_insta: '@doceaurora.exemplo', f_site: '', f_addr: 'Rua das Flores, 120, Centro',
      f_rating: '4,9', f_ratingSrc: 'Google', f_customers: '+1.200', f_customersLabel: 'clientes felizes',
      f_hook1: 'BOLO', f_hook2: 'DE VERDADE', f_pain: 'Cansou de doce sem sabor?', f_search: 'confeitaria artesanal perto de mim', f_product: 'Bolo de pote de ninho', f_benTitle: 'Por que a Doce Aurora?',
      f_b1: 'Feito no mesmo dia', f_i1: 'clock', f_b2: 'Entrega no bairro', f_i2: 'truck', f_b3: 'Peça pelo WhatsApp', f_i3: 'chat', f_b4: '', f_i4: 'star', f_tagline: 'Doce de verdade, do jeito certo.', f_cta: 'Peça pelo WhatsApp',
    },
    en: {
      f_name: 'Golden Crumb', f_segment: 'Confeitaria', f_sells: 'Cupcakes, celebration cakes and pastries made to order, delivered downtown.',
      f_diffs: 'Baked the same day\nLocal delivery\nOrder on WhatsApp', f_offer: '10% OFF your 1st order', f_whats: '+1 555 010 0000', f_insta: '@goldencrumb.example', f_site: '', f_addr: '120 Flower St, Downtown',
      f_rating: '4.9', f_ratingSrc: 'Google', f_customers: '+1,200', f_customersLabel: 'happy customers',
      f_hook1: 'CAKE', f_hook2: 'DONE RIGHT', f_pain: 'Tired of bland desserts?', f_search: 'bakery near me', f_product: 'Vanilla bean cupcake', f_benTitle: 'Why Golden Crumb?',
      f_b1: 'Baked the same day', f_i1: 'clock', f_b2: 'Local delivery', f_i2: 'truck', f_b3: 'Order on WhatsApp', f_i3: 'chat', f_b4: '', f_i4: 'star', f_tagline: 'Sweet, fresh and done right.', f_cta: 'Order on WhatsApp',
    },
    es: {
      f_name: 'Dulce Aurora', f_segment: 'Confeitaria', f_sells: 'Pasteles, cupcakes y postres por encargo, con entrega en el centro.',
      f_diffs: 'Hecho el mismo día\nEntrega a domicilio\nPedidos por WhatsApp', f_offer: '10% OFF en tu 1er pedido', f_whats: '+52 55 0000 0000', f_insta: '@dulceaurora.ejemplo', f_site: '', f_addr: 'Calle de las Flores 120, Centro',
      f_rating: '4.9', f_ratingSrc: 'Google', f_customers: '+1,200', f_customersLabel: 'clientes felices',
      f_hook1: 'PASTEL', f_hook2: 'DE VERDAD', f_pain: '¿Cansado de postres sin sabor?', f_search: 'pastelería cerca de mí', f_product: 'Pastel de tres leches', f_benTitle: '¿Por qué Dulce Aurora?',
      f_b1: 'Hecho el mismo día', f_i1: 'clock', f_b2: 'Entrega a domicilio', f_i2: 'truck', f_b3: 'Pide por WhatsApp', f_i3: 'chat', f_b4: '', f_i4: 'star', f_tagline: 'Dulce de verdad, bien hecho.', f_cta: 'Pide por WhatsApp',
    },
  };
  const EXAMPLE = { ...EXAMPLES[LANG] || EXAMPLES.pt, f_c1: '#ff5c8a', f_c2: '#ffc46b', style: 'moderno', mood: 'energia', motion: 'dinamico', dur: '15' };
  const EX_BIZ = ['f_sells', 'f_diffs', 'f_offer', 'f_whats', 'f_insta', 'f_site', 'f_addr', 'f_rating', 'f_ratingSrc', 'f_customers', 'f_customersLabel'];
  const EMPTY = { ...Object.fromEntries(TEXT_IDS.map((k) => [k, ''])), f_segment: 'Outro', f_c1: '#7c5cff', f_c2: '#ffb547', f_i1: 'check', f_i2: 'clock', f_i3: 'chat', f_i4: 'star', style: 'moderno', mood: 'energia', motion: 'dinamico', dur: '15' };

  // roteiro automático por segmento (sem IA), em cada idioma
  const SEGS = {
    pt: {
      Confeitaria: { q: 'confeitaria perto de mim', hook: ['DOCE', 'DE VERDADE'], pain: 'Cansou de doce sem sabor?', tag: 'Feito com carinho, todo dia.', cta: 'Peça pelo WhatsApp', icon: ['clock', 'truck', 'heart'] },
      Restaurante: { q: 'restaurante perto de mim', hook: ['COMIDA', 'DE VERDADE'], pain: 'Cansou de comer sempre igual?', tag: 'Sabor que faz voltar.', cta: 'Reserve sua mesa', icon: ['flame', 'people', 'star'] },
      Pizzaria: { q: 'pizzaria perto de mim', hook: ['PIZZA', 'DE VERDADE'], pain: 'Pizza fria e sem graça?', tag: 'Sua noite merece essa pizza.', cta: 'Peça agora', icon: ['flame', 'truck', 'clock'] },
      Lanchonete: { q: 'lanchonete perto de mim', hook: ['FOME', 'RESOLVIDA'], pain: 'Lanche frio e demorado?', tag: 'Fome resolvida, rapidinho.', cta: 'Peça agora', icon: ['flame', 'truck', 'card'] },
      Cafeteria: { q: 'cafeteria perto de mim', hook: ['CAFÉ', 'DE VERDADE'], pain: 'Café ruim estraga o dia?', tag: 'Seu café, do jeito certo.', cta: 'Venha tomar um café', icon: ['coffee', 'heart', 'pin'] },
      Moda: { q: 'loja de roupa perto de mim', hook: ['SEU ESTILO', 'COMEÇA AQUI'], pain: 'Nada combina com você?', tag: 'Vista o que você é.', cta: 'Veja a coleção', icon: ['bag', 'truck', 'card'] },
      Beleza: { q: 'salão de beleza perto de mim', hook: ['AUTOESTIMA', 'EM DIA'], pain: 'Sem tempo pra se cuidar?', tag: 'Você merece esse cuidado.', cta: 'Agende seu horário', icon: ['scissors', 'calendar', 'heart'] },
      'Saúde': { q: 'clínica perto de mim', hook: ['SAÚDE', 'EM DIA'], pain: 'Adiando aquela consulta?', tag: 'Cuidar de você é prioridade.', cta: 'Agende sua consulta', icon: ['shield', 'calendar', 'people'] },
      Odontologia: { q: 'dentista perto de mim', hook: ['SORRIA', 'SEM MEDO'], pain: 'Vergonha de sorrir?', tag: 'Seu sorriso em boas mãos.', cta: 'Agende uma avaliação', icon: ['smile', 'calendar', 'card'] },
      Fitness: { q: 'academia perto de mim', hook: ['TREINE', 'DE VERDADE'], pain: 'Travou nos resultados?', tag: 'Seu melhor começa hoje.', cta: 'Agende uma aula', icon: ['dumbbell', 'people', 'calendar'] },
      'Educação': { qf: 'curso perto de mim', hook: ['APRENDA', 'DE VERDADE'], pain: 'Estudando sem sair do lugar?', tag: 'Aprender pode ser leve.', cta: 'Garanta sua vaga', icon: ['book', 'people', 'calendar'] },
      Pet: { q: 'pet shop perto de mim', hook: ['SEU PET', 'MAIS FELIZ'], pain: 'Difícil achar quem cuide bem?', tag: 'Cuidado de quem ama bicho.', cta: 'Agende pelo WhatsApp', icon: ['paw', 'heart', 'calendar'] },
      'Imobiliária': { q: 'imobiliária perto de mim', hook: ['SEU LAR', 'TE ESPERA'], pain: 'Cansou de procurar imóvel?', tag: 'O endereço certo pra você.', cta: 'Fale com um corretor', icon: ['home', 'pin', 'chat'] },
      'Serviços': { qf: 'orçamento perto de mim', hook: ['PROBLEMA', 'RESOLVIDO'], pain: 'Cansou de esperar orçamento?', tag: 'Serviço bem feito, no prazo.', cta: 'Peça um orçamento', icon: ['tool', 'clock', 'shield'] },
      Tecnologia: { qs: ' para empresas', qf: 'tecnologia para empresas', hook: ['MAIS', 'SIMPLES'], pain: 'Perdendo tempo com processos?', tag: 'Tecnologia que simplifica.', cta: 'Fale com a gente', icon: ['bolt', 'shield', 'chat'] },
      Loja: { qf: 'loja perto de mim', hook: ['ACHOU', 'AQUI'], pain: 'Não acha o que procura?', tag: 'Tudo o que você precisa.', cta: 'Visite a loja', icon: ['bag', 'tag', 'card'] },
      Outro: { hook: ['CONHEÇA', ''], pain: 'Procurando quem faça bem?', tag: 'Feito pra você.', cta: 'Fale com a gente', icon: ['check', 'star', 'chat'] },
    },
    en: {
      Confeitaria: { q: 'bakery near me', hook: ['CAKE', 'DONE RIGHT'], pain: 'Tired of bland desserts?', tag: 'Baked fresh with love, daily.', cta: 'Order on WhatsApp', icon: ['clock', 'truck', 'heart'] },
      Restaurante: { q: 'restaurant near me', hook: ['REAL', 'FOOD'], pain: 'Tired of the same old meals?', tag: 'Flavor that brings you back.', cta: 'Book a table', icon: ['flame', 'people', 'star'] },
      Pizzaria: { q: 'pizza near me', hook: ['PIZZA', 'DONE RIGHT'], pain: 'Cold, boring pizza again?', tag: 'Your night deserves this pizza.', cta: 'Order now', icon: ['flame', 'truck', 'clock'] },
      Lanchonete: { q: 'burgers near me', hook: ['HUNGRY?', 'WE GOT YOU'], pain: 'Cold, slow food again?', tag: 'Hunger solved, fast.', cta: 'Order now', icon: ['flame', 'truck', 'card'] },
      Cafeteria: { q: 'coffee shop near me', hook: ['REAL', 'COFFEE'], pain: 'Bad coffee ruining your day?', tag: 'Your coffee, done right.', cta: 'Come have a coffee', icon: ['coffee', 'heart', 'pin'] },
      Moda: { q: 'clothing store near me', hook: ['YOUR STYLE', 'STARTS HERE'], pain: 'Nothing feels like you?', tag: 'Wear who you are.', cta: 'See the collection', icon: ['bag', 'truck', 'card'] },
      Beleza: { q: 'beauty salon near me', hook: ['FEEL GOOD', 'LOOK GREAT'], pain: 'No time to treat yourself?', tag: 'You deserve this care.', cta: 'Book your spot', icon: ['scissors', 'calendar', 'heart'] },
      'Saúde': { q: 'clinic near me', hook: ['HEALTH', 'FIRST'], pain: 'Putting off that checkup?', tag: 'Your health comes first.', cta: 'Book an appointment', icon: ['shield', 'calendar', 'people'] },
      Odontologia: { q: 'dentist near me', hook: ['SMILE', 'WITHOUT FEAR'], pain: 'Shy about your smile?', tag: 'Your smile in good hands.', cta: 'Book a checkup', icon: ['smile', 'calendar', 'card'] },
      Fitness: { q: 'gym near me', hook: ['TRAIN', 'FOR REAL'], pain: 'Stuck on a plateau?', tag: 'Your best starts today.', cta: 'Book a class', icon: ['dumbbell', 'people', 'calendar'] },
      'Educação': { qf: 'courses near me', hook: ['LEARN', 'FOR REAL'], pain: 'Studying and going nowhere?', tag: 'Learning can feel easy.', cta: 'Save your spot', icon: ['book', 'people', 'calendar'] },
      Pet: { q: 'pet shop near me', hook: ['HAPPIER', 'PETS'], pain: 'Hard to find someone you trust?', tag: 'Care from people who love pets.', cta: 'Book on WhatsApp', icon: ['paw', 'heart', 'calendar'] },
      'Imobiliária': { q: 'real estate agent near me', hook: ['YOUR HOME', 'AWAITS'], pain: 'Tired of house hunting?', tag: 'The right address for you.', cta: 'Talk to an agent', icon: ['home', 'pin', 'chat'] },
      'Serviços': { qf: 'quotes near me', hook: ['PROBLEM', 'SOLVED'], pain: 'Tired of waiting for quotes?', tag: 'Work done right, on time.', cta: 'Get a quote', icon: ['tool', 'clock', 'shield'] },
      Tecnologia: { qs: ' for business', qf: 'tech for small business', hook: ['MADE', 'SIMPLE'], pain: 'Wasting time on busywork?', tag: 'Technology that simplifies.', cta: 'Talk to us', icon: ['bolt', 'shield', 'chat'] },
      Loja: { qf: 'store near me', hook: ['FOUND IT', 'RIGHT HERE'], pain: 'Can’t find what you need?', tag: 'Everything you need.', cta: 'Visit the store', icon: ['bag', 'tag', 'card'] },
      Outro: { hook: ['MEET', ''], pain: 'Looking for someone great?', tag: 'Made for you.', cta: 'Talk to us', icon: ['check', 'star', 'chat'] },
    },
    es: {
      Confeitaria: { q: 'pastelería cerca de mí', hook: ['PASTEL', 'DE VERDAD'], pain: '¿Cansado de postres sin sabor?', tag: 'Hecho con cariño, cada día.', cta: 'Pide por WhatsApp', icon: ['clock', 'truck', 'heart'] },
      Restaurante: { q: 'restaurante cerca de mí', hook: ['COMIDA', 'DE VERDAD'], pain: '¿Cansado de comer siempre igual?', tag: 'Sabor que te hace volver.', cta: 'Reserva tu mesa', icon: ['flame', 'people', 'star'] },
      Pizzaria: { q: 'pizzería cerca de mí', hook: ['PIZZA', 'DE VERDAD'], pain: '¿Pizza fría y sin gracia?', tag: 'Tu noche merece esta pizza.', cta: 'Pide ahora', icon: ['flame', 'truck', 'clock'] },
      Lanchonete: { q: 'hamburguesas cerca de mí', hook: ['¿HAMBRE?', 'LO RESOLVEMOS'], pain: '¿Comida fría y tardada?', tag: 'Hambre resuelta, rapidito.', cta: 'Pide ahora', icon: ['flame', 'truck', 'card'] },
      Cafeteria: { q: 'cafetería cerca de mí', hook: ['CAFÉ', 'DE VERDAD'], pain: '¿Un mal café arruina tu día?', tag: 'Tu café, como debe ser.', cta: 'Ven por un café', icon: ['coffee', 'heart', 'pin'] },
      Moda: { q: 'tienda de ropa cerca de mí', hook: ['TU ESTILO', 'EMPIEZA AQUÍ'], pain: '¿Nada va contigo?', tag: 'Viste lo que eres.', cta: 'Mira la colección', icon: ['bag', 'truck', 'card'] },
      Beleza: { q: 'salón de belleza cerca de mí', hook: ['AUTOESTIMA', 'AL DÍA'], pain: '¿Sin tiempo para cuidarte?', tag: 'Mereces este cuidado.', cta: 'Agenda tu cita', icon: ['scissors', 'calendar', 'heart'] },
      'Saúde': { q: 'clínica cerca de mí', hook: ['SALUD', 'AL DÍA'], pain: '¿Posponiendo esa consulta?', tag: 'Cuidarte es prioridad.', cta: 'Agenda tu consulta', icon: ['shield', 'calendar', 'people'] },
      Odontologia: { q: 'dentista cerca de mí', hook: ['SONRÍE', 'SIN MIEDO'], pain: '¿Te da pena sonreír?', tag: 'Tu sonrisa en buenas manos.', cta: 'Agenda una revisión', icon: ['smile', 'calendar', 'card'] },
      Fitness: { q: 'gimnasio cerca de mí', hook: ['ENTRENA', 'DE VERDAD'], pain: '¿Estancado en tus resultados?', tag: 'Tu mejor versión empieza hoy.', cta: 'Agenda una clase', icon: ['dumbbell', 'people', 'calendar'] },
      'Educação': { qf: 'cursos cerca de mí', hook: ['APRENDE', 'DE VERDAD'], pain: '¿Estudias y no avanzas?', tag: 'Aprender puede ser fácil.', cta: 'Aparta tu lugar', icon: ['book', 'people', 'calendar'] },
      Pet: { q: 'tienda de mascotas cerca de mí', hook: ['TU MASCOTA', 'MÁS FELIZ'], pain: '¿Difícil encontrar quién la cuide?', tag: 'Cuidado de quien ama a los animales.', cta: 'Agenda por WhatsApp', icon: ['paw', 'heart', 'calendar'] },
      'Imobiliária': { q: 'inmobiliaria cerca de mí', hook: ['TU HOGAR', 'TE ESPERA'], pain: '¿Cansado de buscar casa?', tag: 'La dirección correcta para ti.', cta: 'Habla con un asesor', icon: ['home', 'pin', 'chat'] },
      'Serviços': { qf: 'presupuesto cerca de mí', hook: ['PROBLEMA', 'RESUELTO'], pain: '¿Cansado de esperar presupuestos?', tag: 'Trabajo bien hecho, a tiempo.', cta: 'Pide un presupuesto', icon: ['tool', 'clock', 'shield'] },
      Tecnologia: { qs: ' para empresas', qf: 'tecnología para empresas', hook: ['MÁS', 'SIMPLE'], pain: '¿Pierdes tiempo en procesos?', tag: 'Tecnología que simplifica.', cta: 'Habla con nosotros', icon: ['bolt', 'shield', 'chat'] },
      Loja: { qf: 'tienda cerca de mí', hook: ['LO ENCONTRASTE', 'AQUÍ'], pain: '¿No encuentras lo que buscas?', tag: 'Todo lo que necesitas.', cta: 'Visita la tienda', icon: ['bag', 'tag', 'card'] },
      Outro: { hook: ['CONOCE', ''], pain: '¿Buscas a alguien que lo haga bien?', tag: 'Hecho para ti.', cta: 'Habla con nosotros', icon: ['check', 'star', 'chat'] },
    },
  };
  const SEG = SEGS[LANG] || SEGS.pt;
  const WORDS_ALL = {
    pt: { split: /\.|;|\n| para | pra /i, conj: /,| e /, stop: /\s+(e|ou|de|da|do|das|dos|com|para|pra|por|em|no|na|nos|nas|a|o|as|os|um|uma)$/i, near: ' perto de mim', why: 'Por que escolher a gente?', verbs: /^(Peça|Agende|Reserve)$/, via: ' pelo WhatsApp', whats: 'Fale no WhatsApp', follow: 'Siga ', bens: ['Atendimento próximo', 'Feito com cuidado'], wBen: 'Fale pelo WhatsApp', iBen: 'Siga no Instagram', oBen: 'Fale com a gente' },
    en: { split: /\.|;|\n| for | to /i, conj: /,| and /, stop: /\s+(and|or|of|for|with|to|the|a|an|in|on|at|by)$/i, near: ' near me', why: 'Why choose us?', verbs: /^(Order|Book)$/, via: ' on WhatsApp', whats: 'Message us on WhatsApp', follow: 'Follow ', bens: ['Friendly service', 'Made with care'], wBen: 'Message us on WhatsApp', iBen: 'Follow us on Instagram', oBen: 'Get in touch' },
    es: { split: /\.|;|\n| para /i, conj: /,| y /, stop: /\s+(y|o|de|del|la|el|los|las|con|para|por|en|un|una|al)$/i, near: ' cerca de mí', why: '¿Por qué elegirnos?', verbs: /^(Pide|Agenda|Reserva)$/, via: ' por WhatsApp', whats: 'Escríbenos por WhatsApp', follow: 'Síguenos: ', bens: ['Atención cercana', 'Hecho con cuidado'], wBen: 'Escríbenos por WhatsApp', iBen: 'Síguenos en Instagram', oBen: 'Escríbenos' },
  };
  const WORDS = WORDS_ALL[LANG] || WORDS_ALL.pt;

  const DRAFT_KEY = `pulso.draft.v3.${LANG}`;
  const state = { engine: null, images: { logo: null, product: null }, audio: null, audioKey: '', audioReady: false, playing: true, t: 0, lastNow: null, dirty: true, soundOn: false, actx: null, src: null, startAt: 0, scale: 0.5, ft: [], revise: null, busy: false, aiEnabled: true, dur: 15 };
  const pv = $('pv');
  const K = () => state.dur / 15; // 20 s = mesma animação 4/3 mais lenta

  // ── formulário
  function readForm() {
    const f = {};
    TEXT_IDS.forEach((k) => { f[k] = $(k).value; });
    f.style = (document.querySelector('input[name=style]:checked') || {}).value || 'moderno';
    f.mood = (document.querySelector('input[name=mood]:checked') || {}).value || 'energia';
    f.motion = (document.querySelector('input[name=motion]:checked') || {}).value || 'dinamico';
    f.dur = (document.querySelector('input[name=dur]:checked') || {}).value || '15';
    return f;
  }
  function writeForm(f) {
    TEXT_IDS.forEach((k) => { if (f[k] != null) $(k).value = f[k]; });
    for (const n of ['style', 'mood', 'motion', 'dur']) { const el = document.querySelector(`input[name=${n}][value="${f[n]}"]`); if (el) el.checked = true; }
    updateCounters(); $('c1v').textContent = $('f_c1').value.toUpperCase(); $('c2v').textContent = $('f_c2').value.toUpperCase();
    setDuration(Number(f.dur) === 20 ? 20 : 15);
  }
  function toSpec(f) {
    const benefits = [1, 2, 3, 4].map((i) => ({ text: f['f_b' + i].trim(), icon: f['f_i' + i] })).filter((b) => b.text);
    return {
      lang: LANG, duration: Number(f.dur) === 20 ? 20 : 15,
      brand: { name: f.f_name.trim(), segment: f.f_segment },
      colors: { primary: f.f_c1, secondary: f.f_c2 },
      style: { font: f.style, mood: f.mood, motion: f.motion === 'premium' ? 'premium' : 'dinamico', watermark: false },
      script: { hook: [f.f_hook1, f.f_hook2].map((s) => s.trim()).filter(Boolean), pain: f.f_pain.trim(), search: f.f_search.trim(), product: f.f_product.trim(), offer: f.f_offer.trim(), benefitsTitle: f.f_benTitle.trim(), benefits, tagline: f.f_tagline.trim(), cta: f.f_cta.trim() },
      proof: { rating: f.f_rating.trim(), ratingSource: f.f_ratingSrc.trim(), customers: f.f_customers.trim(), customersLabel: f.f_customersLabel.trim() },
      contact: { whatsapp: f.f_whats.trim(), instagram: f.f_insta.trim(), site: f.f_site.trim(), address: f.f_addr.trim() },
    };
  }
  function specToForm(s) {
    const f = { ...EMPTY };
    f.f_name = s.brand.name; f.f_segment = s.brand.segment; f.f_c1 = s.colors.primary; f.f_c2 = s.colors.secondary; f.style = s.style.font; f.mood = s.style.mood; f.motion = s.style.motion || 'dinamico'; f.dur = String(s.duration || 15);
    const sc = s.script; f.f_hook1 = sc.hook[0] || ''; f.f_hook2 = sc.hook[1] || ''; f.f_pain = sc.pain; f.f_search = sc.search; f.f_product = sc.product; f.f_offer = sc.offer; f.f_benTitle = sc.benefitsTitle; f.f_tagline = sc.tagline; f.f_cta = sc.cta;
    [1, 2, 3, 4].forEach((i) => { const b = sc.benefits[i - 1]; f['f_b' + i] = b ? b.text : ''; if (b) f['f_i' + i] = b.icon; });
    f.f_rating = s.proof.rating; f.f_ratingSrc = s.proof.ratingSource; f.f_customers = s.proof.customers; f.f_customersLabel = s.proof.customersLabel;
    f.f_whats = s.contact.whatsapp; f.f_insta = s.contact.instagram; f.f_site = s.contact.site; f.f_addr = s.contact.address;
    return f;
  }
  function updateCounters() {
    document.querySelectorAll('[data-count]').forEach((el) => { const inp = $(el.dataset.count), n = inp.value.length, m = +inp.maxLength; el.textContent = `${n}/${m}`; el.classList.toggle('over', n >= m); });
  }
  function saveDraft() { if (state.revise) return; try { localStorage.setItem(DRAFT_KEY, JSON.stringify(readForm())); } catch { /* sem armazenamento */ } }
  function loadDraft() { try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
  function setStatus(msg, cls, id = 'status') { const el = $(id); el.textContent = msg || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }

  // ── duração (15 ou 20 s) e preço
  function setDuration(d) {
    if (d === state.dur && state.durInit) return;
    const frac = state.t / state.dur;
    state.dur = d; state.durInit = true;
    state.t = Math.min(d - 0.01, frac * d);
    document.querySelectorAll('[data-price-now]').forEach((el) => { el.dataset.price = String(d); });
    Site.paintFooter();
    $('specPill').textContent = `${d} s · 1080×1920 · 60 fps`;
    state.dirty = true;
    if (state.engine) scheduleAudio(true);
  }

  // ── motor + trilha
  let rebuildTimer = null, audioTimer = null, audioVersion = 0;
  function scheduleRebuild(d = 200) { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, d); }
  function rebuild() {
    try {
      const spec = toSpec(readForm());
      if (!spec.brand.name) spec.brand.name = T('Sua Empresa');
      state.engine = Pulso.create(spec, state.images); state.dirty = true;
      const v = state.engine.events.variant; SCENES[5] = v === 'proof' ? 'Prova' : v === 'offer' ? 'Oferta' : 'Frase';
      document.querySelectorAll('.seg small').forEach((el, i) => { el.textContent = T(SCENES[i]); });
      scheduleAudio();
    } catch (e) { console.error(e); setStatus(T('A prévia falhou ao montar. Revise os textos e tente de novo.'), 'err'); }
  }
  function audioKey() { const e = state.engine.events; return JSON.stringify([e.mood, e.style, e.typeChars, e.variant, e.benefitsN, e.contactRows, e.hasOffer, state.dur]); }
  function scheduleAudio(force) { if (!state.engine) return; const k = audioKey(); if (!force && k === state.audioKey) return; state.audioReady = false; clearTimeout(audioTimer); audioTimer = setTimeout(() => renderAudio(k), 650); }
  async function renderAudio(k) {
    const v = ++audioVersion; soundLabel();
    try {
      const ab = await PulsoAudio.render(state.engine.events, { mood: state.engine.events.mood, scale: K() });
      if (v !== audioVersion) return;
      state.audio = ab; state.audioKey = k || audioKey(); state.audioReady = true;
      if (state.soundOn && state.playing) startSound();
    } catch (e) { console.error(e); } finally { soundLabel(); }
  }
  async function ensureAudio() { if (state.audioReady && state.audioKey === audioKey()) return state.audio; clearTimeout(audioTimer); await renderAudio(audioKey()); return state.audio; }
  function soundLabel() { const b = $('soundBtn'); b.classList.toggle('on', state.soundOn); b.setAttribute('aria-pressed', String(state.soundOn)); b.querySelector('span').textContent = state.soundOn ? (state.audioReady ? T('Som ligado') : T('Preparando som…')) : T('Ouvir'); }
  function stopSound() { if (state.src) { try { state.src.stop(); } catch { /* já parou */ } state.src.disconnect(); state.src = null; } }
  function startSound() {
    stopSound(); if (!state.audio) return;
    if (!state.actx) state.actx = new AudioContext();
    state.actx.resume();
    const src = state.actx.createBufferSource(); src.buffer = state.audio; src.loop = true; src.connect(state.actx.destination);
    const t = ((state.t % state.dur) + state.dur) % state.dur; src.start(0, Math.min(t, state.audio.duration - 0.01)); state.src = src; state.startAt = state.actx.currentTime - t;
  }

  // ── prévia (sempre com a marca PRÉVIA; o vídeo em alta sai do servidor depois do pagamento)
  function drawWatermark(ctx, w, h) {
    const k = w / 1080, word = T('PRÉVIA');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.17; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(150 * k)}px 'Bricolage Grotesque', sans-serif`;
    ctx.translate(w / 2, h / 2); ctx.rotate(-0.42);
    for (let i = -3; i <= 3; i++) ctx.fillText(word, (i % 2) * 120 * k, i * 380 * k);
    ctx.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.max(9, Math.round(26 * k)), pad = 14 * k, label = T('PRÉVIA · pague para baixar em alta');
    ctx.font = `700 ${fs}px 'IBM Plex Mono', monospace`;
    const tw = ctx.measureText(label).width, bw = tw + pad * 2, bh = fs + pad * 1.2, x = (w - bw) / 2, y = 26 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, bw, bh, bh / 2) : ctx.rect(x, y, bw, bh); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + pad, y + bh / 2 + 1);
    ctx.restore();
  }
  function sizeCanvas() {
    const r = pv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const want = Math.max(0.28, Math.min(0.55, (r.width * dpr) / 1080, state.scale));
    const w = Math.round(1080 * want), h = Math.round(1920 * want);
    if (pv.width !== w || pv.height !== h) { pv.width = w; pv.height = h; state.dirty = true; }
  }
  function adapt(ms) {
    state.ft.push(ms); if (state.ft.length < 30) return;
    const avg = state.ft.reduce((a, b) => a + b, 0) / state.ft.length; state.ft = [];
    if (avg > 26 && state.scale > 0.3) { state.scale = Math.max(0.3, state.scale * 0.8); sizeCanvas(); }
    else if (avg < 9 && state.scale < 0.55) { state.scale = Math.min(0.55, state.scale * 1.15); sizeCanvas(); }
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!state.engine) { state.lastNow = now; return; }
    const D = state.dur;
    if (state.playing) {
      if (state.soundOn && state.src && state.actx) state.t = (((state.actx.currentTime - state.startAt) % D) + D) % D;
      else if (state.lastNow != null) state.t = (state.t + Math.min(0.1, (now - state.lastNow) / 1000)) % D;
    }
    state.lastNow = now;
    if (state.playing || state.dirty) {
      const t0 = performance.now();
      state.engine.renderFrame(pv, state.t / K(), { samples: 1, fps: 60 * K() });
      drawWatermark(pv.getContext('2d'), pv.width, pv.height);
      state.dirty = false; if (state.playing) adapt(performance.now() - t0);
    }
    updateTransport();
  }
  let lastScene = -1;
  function updateTransport() {
    const t = state.t, D = state.dur, s = Math.min(7, Math.floor(t / (D / 8)));
    $('tc').textContent = `${t.toFixed(2).padStart(5, '0')} / ${D.toFixed(2)}`;
    $('ph').style.left = `calc(${(t / D) * 100}% - 1px)`;
    $('tl').setAttribute('aria-valuenow', t.toFixed(1)); $('tl').setAttribute('aria-valuemax', String(D));
    if (s !== lastScene) { lastScene = s; document.querySelectorAll('.seg').forEach((el, i) => el.classList.toggle('cur', i === s)); $('sceneName').innerHTML = Site.esc(T('Cena {n} de 8:', { n: s + 1 })) + ` <b>${Site.esc(T(SCENES[s]))}</b>`; }
  }
  function setPlaying(p) {
    state.playing = p;
    $('playIcon').innerHTML = p ? '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/>' : '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>';
    $('playBtn').setAttribute('aria-label', p ? T('Pausar') : T('Tocar'));
    if (p && state.soundOn) startSound(); else stopSound();
  }
  function seek(t) { state.t = Math.max(0, Math.min(state.dur - 0.01, t)); state.dirty = true; if (state.soundOn && state.playing) startSound(); }

  // ── roteiro automático (sem IA) e com IA (servidor)
  const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; const c = s.slice(0, n + 1); const i = c.lastIndexOf(' '); return (i > n * 0.5 ? c.slice(0, i) : s.slice(0, n)).replace(/[,.;:\s]+$/, ''); };
  const tidy = (s) => { s = String(s || '').replace(/\s+/g, ' ').trim(); let prev; do { prev = s; s = s.replace(/[\s,.;:–-]+$/, '').replace(WORDS.stop, ''); } while (s !== prev); return s; };
  const cutT = (s, n) => tidy(cut(s, n));
  const cap = (s) => s.charAt(0).toLocaleUpperCase(Site.LOC) + s.slice(1);
  function offline(f) {
    const seg = SEG[f.f_segment] || SEG.Outro, name = f.f_name.trim() || T('Sua Empresa');
    const diffs = (f.f_diffs || '').split(/\n|;|•/).map((x) => x.trim()).filter(Boolean);
    const main = tidy((f.f_sells || '').split(WORDS.split)[0]), first = tidy(main.split(WORDS.conj)[0]);
    const product = main && main.length <= 32 ? main : cutT(tidy(main.split(',')[0]) || name, 32);
    const search = seg.q || (first ? first.toLocaleLowerCase(Site.LOC) + (seg.qs || WORDS.near) : seg.qf || name.toLocaleLowerCase(Site.LOC) + WORDS.near);
    const fallback = [...WORDS.bens, f.f_whats ? WORDS.wBen : f.f_insta ? WORDS.iBen : WORDS.oBen];
    const benefits = (diffs.length ? diffs : fallback).slice(0, 3).map((t, i) => ({ text: cutT(cap(t), 30), icon: PU.iconFor(t, seg.icon[i] || 'check') }));
    const verb = seg.cta.split(' ')[0];
    const insta = f.f_insta ? (f.f_insta.startsWith('@') ? f.f_insta : '@' + f.f_insta) : '';
    const cta = f.f_whats ? (WORDS.verbs.test(verb) ? verb + WORDS.via : WORDS.whats) : insta ? WORDS.follow + insta : seg.cta;
    return { hook: [seg.hook[0], seg.hook[1] || cutT(name.toLocaleUpperCase(Site.LOC), 14)], pain: seg.pain, search: cutT(search, 32), product: cap(product), benefitsTitle: WORDS.why, benefits, tagline: seg.tag, cta: cut(cta, 24) };
  }
  function sanitize(o, f) {
    const fb = offline(f), hook = Array.isArray(o && o.hook) ? o.hook : fb.hook;
    const bens = (Array.isArray(o && o.benefits) ? o.benefits : fb.benefits).slice(0, 4).map((b, i) => { const text = cut(b && (b.text || b), 30); const ic = PU.ICON_LIST.includes(b && b.icon) ? b.icon : PU.iconFor(text, fb.benefits[i] ? fb.benefits[i].icon : 'check'); return { text, icon: ic }; }).filter((b) => b.text);
    return { hook: [cut(hook[0] || fb.hook[0], 14), cut(hook[1] || '', 18)], pain: cut(o.pain || fb.pain, 40), search: cut((o.search || fb.search).toLocaleLowerCase(Site.LOC), 40), product: cut(o.product || fb.product, 40), benefitsTitle: cut(o.benefitsTitle || fb.benefitsTitle, 30), benefits: bens.length ? bens : fb.benefits, tagline: cut(o.tagline || fb.tagline, 44), cta: cut(o.cta || fb.cta, 24) };
  }
  function applyScript(s) {
    $('f_hook1').value = s.hook[0] || ''; $('f_hook2').value = s.hook[1] || ''; $('f_pain').value = s.pain; $('f_search').value = s.search; $('f_product').value = s.product; $('f_benTitle').value = s.benefitsTitle;
    [1, 2, 3, 4].forEach((i) => { const b = s.benefits[i - 1]; $('f_b' + i).value = b ? b.text : ''; $('f_i' + i).value = b ? b.icon : $('f_i' + i).value; });
    $('f_tagline').value = s.tagline; $('f_cta').value = s.cta;
    updateCounters(); saveDraft(); rebuild(); seek(0); setPlaying(true);
  }
  async function writeScript() {
    const f = readForm(), status = (m, c) => { const el = $('aiStatus'); el.textContent = m; el.className = 'ai-status' + (c ? ' ' + c : ''); };
    if (!f.f_name.trim()) { status(T('Preencha pelo menos o nome da empresa na etapa 01.'), 'err'); $('f_name').focus(); return; }
    if (!state.aiEnabled) { applyScript(offline(f)); status(T('Roteiro automático aplicado. Ajuste os textos como quiser.')); return; }
    const channel = f.f_whats ? 'WhatsApp' : f.f_insta ? 'Instagram' : f.f_site ? 'site' : 'não informado';
    const brief = { name: f.f_name, segment: f.f_segment, sells: f.f_sells, diffs: f.f_diffs, offer: f.f_offer, channel, style: f.style, lang: LANG };
    $('aiBtn').disabled = true; status(T('Escrevendo o roteiro…'));
    try {
      const r = await Site.api('/api/ai/script', { method: 'POST', body: { brief } });
      applyScript(sanitize(r.script || {}, f)); status(T('Roteiro pronto. Edite o que quiser.'));
    } catch (e) {
      if (e.status === 429 && e.data && e.data.needLogin) {
        status(e.message, 'err');
        Site.ensureLogin({ title: T('Crie sua conta'), sub: T('Com a conta você usa mais a IA e guarda seus vídeos.') }).then(() => writeScript()).catch(() => {});
      } else if (e.status === 429) status(e.message, 'err');
      else { applyScript(offline(f)); status(e.status === 503 ? T('Roteiro automático aplicado. Ajuste os textos como quiser.') : T('A IA não respondeu agora. Apliquei o roteiro automático.')); if (e.status === 503) { state.aiEnabled = false; $('aiLabel').textContent = T('Gerar roteiro automático'); } }
    } finally { $('aiBtn').disabled = false; }
  }

  // ── imagens
  async function loadImage(file) {
    const url = URL.createObjectURL(file), img = new Image(); img.src = url; await img.decode();
    return { canvas: toCanvas(img, 1400), url };
  }
  function toCanvas(img, max) {
    const w = img.naturalWidth || img.width || 512, h = img.naturalHeight || img.height || 512, k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  // as cores da marca saem do próprio logo: tons vivos pesam mais; se o logo tiver uma cor só, a de destaque é uma vizinha dela
  function logoPalette(src) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.drawImage(src, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data, buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue; const hsl = PU.rgb2hsl([d[i], d[i + 1], d[i + 2]]);
      if (hsl.s < 28 || hsl.l < 14 || hsl.l > 90) continue;
      const k = Math.round(hsl.h / 24) % 15, w = hsl.s / 100, b = buckets.get(k) || { n: 0, w: 0, r: 0, g: 0, b: 0, h: hsl.h };
      b.n++; b.w += w; b.r += d[i] * w; b.g += d[i + 1] * w; b.b += d[i + 2] * w; buckets.set(k, b);
    }
    const list = [...buckets.values()].filter((b) => b.n > 12).sort((a, b) => b.w - a.w);
    if (!list.length) return null;
    const hex = (b) => PU.toHex([b.r / b.w, b.g / b.w, b.b / b.w]), p = list[0];
    const s = list.find((b) => b.w > p.w * 0.12 && Math.min(Math.abs(b.h - p.h), 360 - Math.abs(b.h - p.h)) >= 40);
    if (s) return [hex(p), hex(s)];
    const h = PU.rgb2hsl(PU.hex(hex(p)));
    return [hex(p), PU.toHex(PU.hsl2rgb((h.h + 38) % 360, Math.max(55, h.s), Math.min(72, Math.max(56, h.l + 8))))];
  }
  const DEFAULT_COLORS = [[EXAMPLE.f_c1, EXAMPLE.f_c2], [EMPTY.f_c1, EMPTY.f_c2]];
  const colorsAreDefault = () => DEFAULT_COLORS.some(([a, b]) => $('f_c1').value.toLowerCase() === a && $('f_c2').value.toLowerCase() === b);
  function applyLogoColors() {
    if (!state.logoPal) return;
    $('f_c1').value = state.logoPal[0]; $('f_c2').value = state.logoPal[1];
    $('c1v').textContent = $('f_c1').value.toUpperCase(); $('c2v').textContent = $('f_c2').value.toUpperCase();
    state.autoColors = [$('f_c1').value, $('f_c2').value];
    saveDraft(); rebuild();
  }
  const UPL = { logo: ['f_logo', 't_logo', 'n_logo', 'x_logo', 'PNG ou JPG, opcional'], product: ['f_photo', 't_photo', 'n_photo', 'x_photo', 'Opcional. Foto vertical fica melhor'] };
  function showImage(key, canvas, url, name) {
    const [inputId, thumbId, nameId, removeId] = UPL[key];
    state.images[key] = canvas; $(thumbId).style.backgroundImage = url ? `url("${url}")` : ''; $(nameId).textContent = name; $(removeId).hidden = !!state.revise || !canvas; $(inputId).closest('.drop').classList.toggle('has', !!canvas);
  }
  function bindUpload(key) {
    const [inputId, , , removeId, hint] = UPL[key];
    $(inputId).addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('grande');
        const { canvas, url } = await loadImage(file);
        showImage(key, canvas, url, file.name);
        if (key === 'logo') {
          state.logoPal = logoPalette(canvas); $('logoColors').hidden = !state.logoPal;
          // cores ainda no padrão (ou postas por um logo anterior): aplica as do logo sozinho
          const auto = state.autoColors && $('f_c1').value === state.autoColors[0] && $('f_c2').value === state.autoColors[1];
          if (state.logoPal && !state.revise && (colorsAreDefault() || auto)) { applyLogoColors(); setStatus(T('Usei as cores do seu logo. Troque quando quiser.'), 'ok'); }
          else { if (state.logoPal) setStatus(T('Dica: “Usar cores do logo” aplica as cores da sua marca.')); rebuild(); }
        } else rebuild();
      } catch { setStatus(T('Não consegui abrir essa imagem. Tente um PNG ou JPG de até 25 MB.'), 'err'); }
      e.target.value = '';
    });
    $(removeId).addEventListener('click', () => { showImage(key, null, '', T(hint)); if (key === 'logo') $('logoColors').hidden = true; rebuild(); });
  }
  // o que vai para o servidor: logo em PNG (mantém transparência), foto em JPEG — sempre abaixo do limite de 3 MB
  function imageData(key) {
    const c = state.images[key];
    if (!c) return null;
    if (key === 'logo') {
      const small = c.width > 900 || c.height > 900 ? toCanvas(c, 900) : c;
      const png = small.toDataURL('image/png');
      return png.length < 3_800_000 ? png : small.toDataURL('image/jpeg', 0.9);
    }
    let q = 0.88, out = c.toDataURL('image/jpeg', q);
    while (out.length > 3_800_000 && q > 0.5) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
    return out;
  }

  // ── compra
  function problem(spec) {
    if (!spec.brand.name) return [T('Preencha o nome da empresa.'), 'f_name'];
    if (!spec.script.hook.length) return [T('Preencha o gancho (a primeira frase do vídeo) ou use o botão de roteiro.'), 'f_hook1'];
    if (!spec.script.product) return [T('Preencha o produto ou serviço em destaque.'), 'f_product'];
    if (!spec.script.benefits.length) return [T('Preencha pelo menos uma vantagem.'), 'f_b1'];
    if (!spec.script.cta) return [T('Preencha a chamada para ação.'), 'f_cta'];
    if (Object.values(EXAMPLES).some((ex) => ex.f_name === readForm().f_name.trim())) return [T('Troque o exemplo pelos dados da sua empresa antes de comprar.'), 'f_name'];
    return null;
  }
  async function buy() {
    if (state.busy) return;
    const f = readForm(), spec = toSpec(f), p = problem(spec);
    if (p) { setStatus(p[0], 'err'); Site.toast(p[0], true); $(p[1]).focus(); $(p[1]).scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    try { await Site.ensureLogin({ title: T('Falta pouco!'), sub: T('Crie sua conta para pagar e receber o vídeo. Ele fica salvo em Meus vídeos.') }); }
    catch { return; }
    state.busy = true; $('buyBtn').disabled = true; $('mbarBtn').disabled = true; setStatus(T('Preparando o pedido…'));
    try {
      const r = await Site.api('/api/orders', { method: 'POST', body: { spec, logo: imageData('logo'), photo: imageData('product'), lang: LANG, duration: spec.duration, brief: { sells: f.f_sells, diffs: f.f_diffs } } });
      if (r.checkoutUrl) { setStatus(T('Abrindo o pagamento…'), 'ok'); location.href = r.checkoutUrl; return; }
      setStatus(r.checkoutError || T('Pedido criado. Abrindo…'));
      location.href = `${P('order')}/${r.order.id}`;
    } catch (e) {
      setStatus(e.message, 'err'); Site.toast(e.message, true);
    } finally { state.busy = false; $('buyBtn').disabled = false; $('mbarBtn').disabled = false; }
  }

  // ── correção grátis de um vídeo já pago
  async function startRevise(id) {
    try { await Site.ensureLogin({ title: T('Entre para corrigir'), sub: T('Use a mesma conta da compra.'), mode: 'login' }); }
    catch { location.href = P('videos'); return false; }
    let r;
    try { r = await Site.api(`/api/orders/${encodeURIComponent(id)}/spec`); }
    catch (e) { Site.toast(e.message, true); location.href = P('videos'); return false; }
    const o = r.order;
    if (!o.canRevise) { Site.toast(o.editsLeft <= 0 ? T('A correção grátis deste vídeo já foi usada.') : T('Este vídeo ainda não está pronto para correção.'), true); location.href = `${P('order')}/${o.id}`; return false; }
    state.revise = o;
    writeForm(specToForm(r.spec));
    const load = async (key, kind, has) => {
      if (!has) { showImage(key, null, '', T('Sem imagem')); return; }
      const img = new Image(); img.src = `/api/orders/${o.id}/image/${kind}`; await img.decode();
      showImage(key, toCanvas(img, 1400), img.src, T('Imagem enviada na compra'));
    };
    await Promise.all([load('logo', 'logo', r.hasLogo), load('product', 'photo', r.hasPhoto)]).catch(() => {});
    ['f_logo', 'f_photo'].forEach((id2) => { $(id2).disabled = true; $(id2).closest('.drop').classList.add('locked'); });
    $('f_name').disabled = true;
    document.querySelectorAll('input[name=dur]').forEach((el) => { el.disabled = true; });
    $('exampleNote').hidden = true; $('reviseNote').hidden = false; $('buyBox').hidden = true; $('reviseBox').hidden = false; $('mbar').hidden = true; document.body.classList.remove('has-mbar');
    $('edTitle').textContent = T('Corrigir: {brand}', { brand: o.brand }); $('edSub').textContent = T('Ajuste o que precisar e gere a nova versão.');
    $('reviseInfo').textContent = T('{n} disponível', { n: o.editsLeft });
    $('reviseCancel').href = `${P('order')}/${o.id}`;
    return true;
  }
  async function submitRevise() {
    if (state.busy) return;
    const f = readForm(); f.f_name = state.revise.brand;
    const spec = toSpec(f), p = problem(spec);
    if (p && p[1] !== 'f_name') { setStatus(p[0], 'err', 'reviseStatus'); $(p[1]).focus(); return; }
    state.busy = true; $('reviseBtn').disabled = true; setStatus(T('Enviando a correção…'), '', 'reviseStatus');
    try { await Site.api(`/api/orders/${state.revise.id}/revise`, { method: 'POST', body: { spec } }); location.href = `${P('order')}/${state.revise.id}`; }
    catch (e) { setStatus(e.message, 'err', 'reviseStatus'); }
    finally { state.busy = false; $('reviseBtn').disabled = false; }
  }

  // ── minha marca: o próximo vídeo começa com o logo, as cores, o estilo e os contatos do último
  async function offerBrand() {
    if (state.revise) return;
    try { if (sessionStorage.getItem('pulso.brandHidden')) return; } catch { /* ok */ }
    const me = await Site.loadMe(); if (!me) return;
    let r; try { r = await Site.api('/api/brand'); } catch { return; }
    const b = r && r.brand; if (!b || !b.brand || !b.brand.name) return;
    if (readForm().f_name.trim() === b.brand.name) return; // já está usando
    state.brandKit = b; $('brandName').textContent = b.brand.name; $('brandNote').hidden = false;
  }
  async function useBrand() {
    const b = state.brandKit; if (!b) return;
    const cur = readForm(), f = { ...EMPTY };
    f.f_name = b.brand.name; f.f_segment = b.brand.segment || 'Outro'; f.f_c1 = b.colors.primary; f.f_c2 = b.colors.secondary;
    f.style = b.style.font; f.mood = b.style.mood; f.motion = b.style.motion || 'dinamico'; f.dur = cur.dur;
    f.f_sells = b.sells || ''; f.f_diffs = b.diffs || '';
    f.f_whats = b.contact.whatsapp || ''; f.f_insta = b.contact.instagram || ''; f.f_site = b.contact.site || ''; f.f_addr = b.contact.address || '';
    f.f_rating = b.proof.rating || ''; f.f_ratingSrc = b.proof.ratingSource || ''; f.f_customers = b.proof.customers || ''; f.f_customersLabel = b.proof.customersLabel || '';
    state.exCleared = true; writeForm(f);
    $('exampleNote').hidden = true; $('brandNote').hidden = true;
    // o logo vem da marca salva; sem logo salvo, não fica o logo de outra empresa que estava no formulário
    showImage('logo', null, '', T('PNG ou JPG, opcional')); state.logoPal = null; $('logoColors').hidden = true;
    if (b.hasLogo) {
      try { const img = new Image(); img.src = `/api/brand/logo?t=${b.updatedAt}`; await img.decode(); showImage('logo', toCanvas(img, 1400), img.src, T('Logo da sua marca')); state.logoPal = logoPalette(state.images.logo); $('logoColors').hidden = !state.logoPal; }
      catch { /* sem logo */ }
    }
    applyScript(offline(readForm()));
    setStatus(T('Sua marca foi aplicada. Agora escreva o roteiro do novo vídeo (ou use a IA).'), 'ok');
    $('aiBtn').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ── montagem da página
  function buildForm() {
    $('f_segment').innerHTML = SEGMENTS.map((s) => `<option value="${s}">${Site.esc(T(s))}</option>`).join('');
    const opts = PU.ICON_LIST.map((k) => `<option value="${k}">${Site.esc(T(ICON_LABELS[k] || k))}</option>`).join('');
    $('bens').innerHTML = [1, 2, 3, 4].map((i) => `<div class="ben"><label class="fld"><span>${Site.esc(T('Vantagem {n}', { n: i }))}${i === 4 ? ' ' + Site.esc(T('(opcional)')) : ''} <i data-count="f_b${i}"></i></span><input type="text" id="f_b${i}" maxlength="30"></label><label class="fld"><span>${Site.esc(T('Ícone'))}</span><select id="f_i${i}">${opts}</select></label></div>`).join('');
    const tl = $('tl'); SCENES.forEach((n) => { const d = document.createElement('div'); d.className = 'seg'; d.innerHTML = `<div class="bar"></div><small>${Site.esc(T(n))}</small>`; tl.appendChild(d); });
  }
  function bind() {
    const onEdit = (e) => {
      const id = e.target.id;
      if (id === 'f_c1') $('c1v').textContent = e.target.value.toUpperCase();
      if (id === 'f_c2') $('c2v').textContent = e.target.value.toUpperCase();
      if (e.target.name === 'dur') setDuration(Number(e.target.value) === 20 ? 20 : 15);
      if (id === 'f_name' && !state.exCleared && e.target.value.trim() !== EXAMPLE.f_name) {
        // os dados de contato, oferta e avaliação do exemplo fictício nunca podem ir para o vídeo de uma empresa real
        state.exCleared = true;
        // tudo o que ainda é igual ao exemplo sai, campo a campo (endereço, oferta, avaliação, diferenciais…)
        const left = EX_BIZ.filter((k) => EXAMPLE[k] && $(k).value === EXAMPLE[k]);
        if (left.length) { left.forEach((k) => { $(k).value = ''; }); setStatus(T('Apaguei os dados do exemplo (contato, oferta e avaliação). Preencha com os da sua empresa.')); }
      }
      updateCounters(); saveDraft(); $('exampleNote').hidden = true;
      scheduleRebuild(e.type === 'change' ? 0 : 220);
    };
    document.querySelector('.form').addEventListener('input', onEdit);
    document.querySelector('.form').addEventListener('change', onEdit);
    $('playBtn').addEventListener('click', () => setPlaying(!state.playing));
    $('soundBtn').addEventListener('click', async () => { state.soundOn = !state.soundOn; soundLabel(); if (state.soundOn) { if (!state.playing) setPlaying(true); await ensureAudio(); startSound(); } else stopSound(); soundLabel(); });
    const tl = $('tl'); let drag = false;
    const pos = (e) => { const r = tl.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * state.dur; };
    tl.addEventListener('pointerdown', (e) => { drag = true; tl.setPointerCapture(e.pointerId); seek(pos(e)); });
    tl.addEventListener('pointermove', (e) => { if (drag) seek(pos(e)); });
    tl.addEventListener('pointerup', () => { drag = false; });
    tl.addEventListener('keydown', (e) => { const step = 0.46875 * K(); if (e.key === 'ArrowRight') { seek(state.t + step); e.preventDefault(); } else if (e.key === 'ArrowLeft') { seek(state.t - step); e.preventDefault(); } else if (e.key === ' ') { setPlaying(!state.playing); e.preventDefault(); } });
    $('aiBtn').addEventListener('click', writeScript);
    $('buyBtn').addEventListener('click', buy);
    $('mbarBtn').addEventListener('click', buy);
    $('reviseBtn').addEventListener('click', submitRevise);
    $('logoColors').addEventListener('click', applyLogoColors);
    $('brandUse').addEventListener('click', useBrand);
    $('brandHide').addEventListener('click', () => { $('brandNote').hidden = true; try { sessionStorage.setItem('pulso.brandHidden', '1'); } catch { /* ok */ } });
    $('brandForget').addEventListener('click', async () => {
      if (!window.confirm(T('Apagar a marca salva (logo, cores e contatos)? Os vídeos já feitos continuam.'))) return;
      try { await Site.api('/api/brand', { method: 'DELETE' }); $('brandNote').hidden = true; state.brandKit = null; Site.toast(T('Marca apagada.')); }
      catch (e) { Site.toast(e.message, true); }
    });
    $('clearBtn').addEventListener('click', () => { state.exCleared = true; writeForm(EMPTY); $('exampleNote').hidden = true; saveDraft(); rebuild(); seek(0); $('f_name').focus(); });
    bindUpload('logo'); bindUpload('product');
    new ResizeObserver(sizeCanvas).observe(pv);
  }
  async function fonts() {
    const faces = ["800 40px 'Bricolage Grotesque'", "800 40px 'Big Shoulders Display'", "400 40px 'Gloock'", "400 40px 'Instrument Sans'", "600 40px 'Instrument Sans'", "700 40px 'Instrument Sans'", "400 40px 'IBM Plex Mono'", "500 40px 'IBM Plex Mono'", "700 40px 'IBM Plex Mono'"];
    try { await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 5000))]); } catch { /* usa fontes do sistema */ }
  }

  async function start() {
    buildForm();
    bind();
    const reviseId = new URLSearchParams(location.search).get('revisar');
    let revising = false;
    if (reviseId) revising = await startRevise(reviseId);
    if (!revising) {
      const draft = loadDraft();
      writeForm(draft || EXAMPLE);
      if (draft && draft.f_name !== EXAMPLE.f_name) { $('exampleNote').hidden = true; state.exCleared = true; }
    }
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { state.t = 6.8 * K(); setPlaying(false); }
    await fonts();
    sizeCanvas(); rebuild(); requestAnimationFrame(loop);
    Site.config().then((c) => { state.aiEnabled = c.aiEnabled !== false; if (!state.aiEnabled) $('aiLabel').textContent = T('Gerar roteiro automático'); });
    offerBrand();
    // em dólar o Stripe não aceita cartão emitido no Brasil: quem está no Brasil paga em reais pela versão em português
    if (LANG !== 'pt') {
      const p = document.createElement('p'); p.className = 'fine';
      p.innerHTML = `${Site.esc(T('Cartão emitido no Brasil?'))} <a href="/criar" hreflang="pt-BR">${Site.esc(T('Pague com Pix na versão em português.'))}</a>`;
      $('buyBox').appendChild(p);
    }
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => scheduleRebuild(50));
  }
  window.PulsoEditor = { state, rebuild, seek, readForm, toSpec, offline, sanitize, setDuration, useBrand };
  start();
})();
