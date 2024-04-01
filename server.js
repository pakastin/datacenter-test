import { cloudflare, hetzner, upcloud } from '@pakastin/datacenters';
import express from 'express';
import { distance, point } from '@turf/turf';

const { NODE_PORT } = process.env;

const app = express();

app.get('/', async (req, res, next) => {
  const cf = req.get('cf-ray').split('-')[1];
  const nearestHetzner = nearest(cf, hetzner);
  const nearestUpCloud = nearest(cf, upcloud);

  res.set('Cache-Control', 'private, no-store');
  res.send([
    `Cloudflare node: ${cloudflare[cf].city}`,
    `Nearest Hetzner data center: ${nearestHetzner.city}, distance ${Math.round(nearestHetzner.distance)} km.`,
    `Nearest UpCloud data center: ${nearestUpCloud.city}, distance ${Math.round(nearestUpCloud.distance)} km.`
  ].join('<br>'));
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
