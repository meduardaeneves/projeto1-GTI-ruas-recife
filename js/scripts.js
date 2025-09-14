// ===== MAPA =====
var map = L.map('map', {
  zoomControl: true,
  scrollWheelZoom: false, // sem zoom na rodinha
  maxZoom: 19,
  minZoom: 12
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ===== PAINEL LATERAL (Form) =====
const side       = document.getElementById('side');
const sideTitle  = document.getElementById('side-title');
const sideIframe = document.getElementById('side-iframe');
const sideClose  = document.getElementById('side-close');

function openSide(title, url){
  sideTitle.textContent = title || 'Formulário';
  if (url) {
    const embed = url.includes('embedded=true')
      ? url
      : url + (url.includes('?') ? '&' : '?') + 'embedded=true';
    sideIframe.src = embed;
  } else {
    sideIframe.removeAttribute('src');
  }
  side.classList.add('open');
  side.setAttribute('aria-hidden', 'false');
}
function closeSide(){
  side.classList.remove('open');
  side.setAttribute('aria-hidden', 'true');
  sideIframe.removeAttribute('src');
}
if (sideClose) sideClose.addEventListener('click', closeSide);

// ===== GEOJSON =====
fetch('data/rua_teste_links.geojson')
  .then(res => res.json())
  .then(data => {
    const layer = L.geoJSON(data, {
      style: { weight: 3 },
      onEachFeature: function (feature, lyr) {
        const props = feature.properties || {};
        const nome  = props.nlgpavofic || "Sem nome";
        const pav   = props.indpav || "Não informado";
        const link  = props.link_formu || ""; // << link do Forms

        // Pega um vértice pra Street View (ajuste se sua geometria variar)
        let lng, lat;
        try { // Polygon/Multipolygon
          lng = feature.geometry.coordinates[0][0][0];
          lat = feature.geometry.coordinates[0][0][1];
        } catch (e) { // LineString
          lng = feature.geometry.coordinates[0][0];
          lat = feature.geometry.coordinates[0][1];
        }

        const streetViewLink =
          `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}" target="_blank">Visualizar 360 da rua</a>`;

        const popupContent = `
          <b>Rua:</b> ${nome}<br>
          <b>Pavimentação:</b> ${pav}<br>
          ${streetViewLink}
        `;
        lyr.bindPopup(popupContent);

        // Clique: abre popup + painel com o Forms
        lyr.on('click', (e) => {
          lyr.openPopup(e.latlng);
          openSide(nome, link);
        });
      }
    }).addTo(map);

    // Enquadra sempre na área do GeoJSON (centraliza) + leve deslocamento pra baixo
    const bounds = layer.getBounds();
    map.fitBounds(bounds, {
      maxZoom: 18,
      paddingTopLeft: [20, 20],
      paddingBottomRight: [20, 100] // empurra o “centro” um pouco pra baixo
    });
    map.panBy([0, 60]); // ajuste fino (px). Aumente/diminua se quiser

    // (opcional) manter navegação dentro da área com folga
    const padded = bounds.pad(0.12);
    map.setMaxBounds(padded);
    map.on('drag', () => map.panInsideBounds(padded, { animate: true }));

    // Reenquadra ao redimensionar a janela
    window.addEventListener('resize', () => {
      map.fitBounds(bounds, {
        maxZoom: 18,
        paddingTopLeft: [20, 20],
        paddingBottomRight: [20, 100]
      });
    });

    map.on('click', (e) => {
      // só fecha se o clique não for em uma feature (Leaflet dispara antes no layer)
      closeSide();
    });
  })
  .catch(err => console.error('Erro ao carregar rua_teste_links.geojson:', err));