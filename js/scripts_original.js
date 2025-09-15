// ===== Helpers do painel =====
const side       = document.getElementById('side');
const sideTitle  = document.getElementById('side-title');
const sideIframe = document.getElementById('side-iframe');
const sideClose  = document.getElementById('side-close');

function openSide(title, url){
  sideTitle.textContent = title || 'Formulário';
  if (url) {
    const embed = url.includes('embedded=true') ? url : url + (url.includes('?') ? '&' : '?') + 'embedded=true';
    sideIframe.src = embed;
  } else {
    sideIframe.removeAttribute('src');
  }
  side.classList.add('open');
  side.setAttribute('aria-hidden', 'false');
  // recalcula tamanho do mapa após a transição do painel
  setTimeout(() => map.resize(), 320);
}
function closeSide(){
  side.classList.remove('open');
  side.setAttribute('aria-hidden', 'true');
  sideIframe.removeAttribute('src');
  setTimeout(() => map.resize(), 320);
}
sideClose && sideClose.addEventListener('click', closeSide);

// ===== MapLibre GL =====
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      // Raster OSM como fundo
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' }
    ]
  },
  center: [-34.871, -8.064], // Recife (aprox) - inicial; depois ajustamos pelos dados
  zoom: 14,
  maxZoom: 20,
  minZoom: 10
});

// Cursor “mãozinha” quando passar por cima das linhas
function setPointer(on) {
  map.getCanvas().style.cursor = on ? 'pointer' : '';
}

// Carrega seu GeoJSON (propriedades: nlgpavofic, indpav, link_formu)
fetch('data/rua_teste_links.geojson')
  .then(r => r.json())
  .then(geojson => {
    // Fonte dos dados
    map.addSource('ruas', { type: 'geojson', data: geojson });

    // Layer de linhas
    map.addLayer({
      id: 'ruas-line',
      type: 'line',
      source: 'ruas',
      paint: {
        'line-color': '#4f8cff',
        'line-width': 3
      }
    });

    // Marker para mostrar o “snap” exato clicado
    const markerEl = document.createElement('div');
    markerEl.style.cssText = `
      width: 12px; height: 12px; border-radius: 50%;
      background:#22c55e; border:2px solid white; box-shadow:0 0 0 2px rgba(0,0,0,.25);
    `;
    const marker = new maplibregl.Marker({ element: markerEl, anchor: 'center' });

    // Popup reutilizável
    const popup = new maplibregl.Popup({
      closeOnClick: true,
      offset: 12,
      anchor: 'bottom'
    });

    // Calcula bbox do GeoJSON e ajusta o mapa (fica centralizado em qualquer tela)
    const b = turf.bbox(geojson); // [minX, minY, maxX, maxY]
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
      padding: { top: 20, left: 20, right: 320, bottom: 40 }, // reserva espaço pro painel quando abrir
      maxZoom: 18
    });

    // Interações: highlight de hover (opcional)
    map.on('mousemove', 'ruas-line', () => setPointer(true));
    map.on('mouseleave', 'ruas-line', () => setPointer(false));

    // Clique com “snap” preciso ao eixo da linha + popup + painel
    map.on('click', (e) => {
      // 1) Quais features estão debaixo do clique?
      const features = map.queryRenderedFeatures(e.point, { layers: ['ruas-line'] });
      if (!features.length) {
        // Clique fora de linhas → fecha painel e popup
        popup.remove();
        closeSide();
        return;
      }

      // 2) Pega a linha mais “perto” (pega a primeira) e calcula o ponto mais próximo
      const f = features[0]; // Feature como LineString/MultilineString
      const line = (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') ? f : null;
      if (!line) return;

      const clickPt = turf.point([e.lngLat.lng, e.lngLat.lat]);
      const snapped = turf.nearestPointOnLine(line, clickPt, { units: 'meters' });

      // 3) Posiciona um marcador exatamente no ponto “snapado”
      const [lng, lat] = snapped.geometry.coordinates;
      marker.setLngLat([lng, lat]).addTo(map);

      // 4) Informações e links
      const props = f.properties || {};
      const nome  = props.nlgpavofic || 'Sem nome';
      const pav   = props.indpav || 'Não informado';
      const form  = props.link_formu || '';

      // Street View com localização precisa (ponto snapado)
      const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

      // 5) Popup com nome, pavimentação e link 360°
      const html = `
        <b>Rua:</b> ${nome}<br>
        <b>Pavimentação:</b> ${pav}<br>
        <a href="${svUrl}" target="_blank" rel="noopener">Abrir no Google Maps (360°)</a>
      `;
      popup.setLngLat([lng, lat]).setHTML(html).addTo(map);

      // 6) Abre painel lateral com o formulário correspondente
      openSide(nome, form);
    });

    // Reajusta bounds ao redimensionar
    window.addEventListener('resize', () => {
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
        padding: { top: 20, left: 20, right: side.classList.contains('open') ? 360 : 20, bottom: 40 },
        maxZoom: 18
      });
    });
  })
  .catch(err => console.error('Erro ao carregar GeoJSON:', err));