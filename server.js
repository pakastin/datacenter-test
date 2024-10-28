import { cloudflare, hetzner, upcloud } from '@pakastin/datacenters';
import express from 'express';
import { distance, point } from '@turf/turf';

const data = { cloudflare, hetzner, upcloud };

const { NODE_PORT = 8080, PING_SERVERS } = process.env;

const app = express();

app.get('/', async (req, res, next) => {
  const cf = req.get('cf-ray').split('-')[1];
  const nearestHetzner = nearest(cf, hetzner);
  const nearestUpCloud = nearest(cf, upcloud);

  res.set('Cache-Control', 'private, no-store');
  res.send([
    `Cloudflare node you're connected to: ${cloudflare[cf].city}`,
    `Nearest Hetzner data center: ${nearestHetzner.city}, distance ${Math.round(nearestHetzner.distance)} km.`,
    `Nearest UpCloud data center: ${nearestUpCloud.city}, distance ${Math.round(nearestUpCloud.distance)} km.`
  ].join('<br>'));
});

app.get('/ping', async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  res.send(`<!DOCTYPE html>
<body>
  <script>
  (async () => {
    const servers = ${JSON.stringify((PING_SERVERS || '').split(','), null, 2)};

    await new Promise((resolve) => setTimeout(resolve, 1000));

    for (const server of servers) {
      const startTime = Date.now();
      let latency;
      try {
        await fetch('https://' + server + '/ping');
        latency = (Date.now() - startTime) + ' ms';
      } catch (err) {
        latency = '-';
      }
      const $result = document.createElement('p');
      $result.textContent = server + ': ' + latency;
      document.body.appendChild($result);
    }
  })();
    </script>
</body>
</html>`);
});

['cloudflare', 'hetzner', 'upcloud'].forEach(company => {
  app.get(`/${company}.geojson`, async (req, res, next) => {
    res.set('Cache-Control', `public, max-age=${60 * 60}`);
    res.send({
      type: 'FeatureCollection',
      features: Object.entries(data[company]).map(([code, datacenter]) => {
        const { city, country, lat, lng } = datacenter;

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          properties: {
            code,
            city,
            country
          }
        };
      })
    });
  });

  app.get(`/${company}/map.html`, async (req, res, next) => {
    res.set('Cache-Control', `public, max-age=${60}`);
    res.send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://flyk.com/maplibre-gl/maplibre-gl.css">
    <style>
      #map {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://flyk.com/maplibre-gl/maplibre-gl.js"></script>
    <script>
      (async () => {
        const style = await fetch('https://flyk.com/style/style.json').then(res => res.json());
        
        style.sources['${company}'] = {
          type: 'geojson',
          data: '../${company}.geojson'
        };

        style.layers.push({
          id: '${company}',
          source: '${company}',
          type: 'circle'
        });

        const map = new maplibregl.Map({
          container: 'map',
          style
        });
      })();
    </script>
  </body>
</html>`);
  });
});

app.listen(NODE_PORT, (err) => {
  if (err) {
    throw new Error(err);
  }
  console.log(`Listening to ${NODE_PORT}`);
});

function nearest (code, datacenters) {
  if (datacenters[code]) {
    return {
      ...datacenters[code],
      distance: 0
    };
  }
  const cf = cloudflare[code];
  return Object.values(datacenters).map((datacenter) => {
    return {
      ...datacenter,
      distance: distance(point([cf.lng, cf.lat]), point([datacenter.lng, datacenter.lat]))
    };
  }).sort((a, b) => {
    return a.distance - b.distance;
  })[0];
}
