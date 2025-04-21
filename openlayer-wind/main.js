import './style.css';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import {DEVICE_PIXEL_RATIO} from 'ol/has.js';
import Flow from 'ol/layer/Flow.js';
import WebGLVectorLayer from 'ol/layer/WebGLVector.js';
import {get as getProjection, transform} from 'ol/proj.js';
import DataTileSource from 'ol/source/DataTile.js';
import VectorSource from 'ol/source/Vector.js';
import {createXYZ, wrapX} from 'ol/tilegrid.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import MVT from 'ol/format/MVT.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';

import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';

import Fill from 'ol/style/Fill.js';
import RegularShape from 'ol/style/RegularShape.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import Circle from 'ol/style/Circle.js';
import WebGLTile from 'ol/layer/WebGLTile.js';

import {getBottomRight} from 'ol/extent';
import {getTopLeft} from 'ol/extent';
import {getCenter} from 'ol/extent';

import { fromUrl, fromArrayBuffer, fromBlob  } from "geotiff";

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    }),
  ],
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});

const shaft = new RegularShape({
  points: 2,
  radius: 5,
  stroke: new Stroke({
    width: 2,
    color: 'black',
  }),
  rotateWithView: true,
});

const head = new RegularShape({
  points: 3,
  radius: 5,
  fill: new Fill({
    color: 'black',
  }),
  rotateWithView: true,
});

// const styles = [new Style({image: shaft}), new Style({image: head})];
const styles = [new Style({image: shaft}),];

// vector tile server
const layer = new VectorTileLayer({
    source: new VectorTileSource({
        format: new MVT(),
        url: 'http://0.0.0.0:3000/wind/{z}/{x}/{y}',
    }),
    minZoom: 7,
    style: function (feature) {
        const properties = feature.getProperties();
        // rotate arrow away from wind origin
        const angle = properties.direction;
        const scale = Math.sqrt((properties.u ** 2) + (properties.v ** 2)) / 10;
        shaft.setScale([1, scale]);
        shaft.setRotation(angle);
        head.setDisplacement([
          0,
          head.getRadius() / 2 + shaft.getRadius() * scale,
        ]);
        head.setRotation(angle);
        return styles;
    },
});
// map.addLayer(layer);

// vector tile files
/*
const vectorSource = new VectorTileSource({
      tileUrlFunction: function (tileCoord) {
        // Use the tile coordinate as a pseudo URL for caching purposes
        return JSON.stringify(tileCoord);
      },
      tileLoadFunction: function (tile, url) {
        const tileCoord = JSON.parse(url);
        const tileGrid = vectorSource.getTileGrid();
        const extent = vectorSource.getTileGrid().getTileCoordExtent(tileCoord);
        const mapProjection = getProjection('EPSG:3857');
        const targetProjection = getProjection('EPSG:4326');
        const center = transform(getCenter(extent), mapProjection, targetProjection);
        console.log(center);
        console.log(getCenter(extent));
        const feature = new Feature({
          geometry: new Point(getCenter(extent)),
        });
        feature.setProperties({
            direction: Math.random() * 360, // Example random direction
            u: Math.random() * 200,
            v: Math.random() * 200,
          });
        tile.setFeatures([feature]);
      },
    });
*/
const vectorLayer = new VectorTileLayer({
    // source: vectorSource,
    minZoom: 7,
    style: function (feature) {
    const direction = feature.get('direction');
    const radius = 5 + (feature.get('u') / 50); // Example: radius based on 'u'

    return new Style({
      image: new Circle({
        radius: radius,
        fill: new Fill({ color: `hsl(${direction}, 80%, 50%)` }), // Color based on direction
        stroke: new Stroke({ color: 'black', width: 1 }),
      }),
    });
  },
});

map.addLayer(vectorLayer);

const url = 'icon_global_WGS84_0125_single-level_2025041800_000_WIND_10M.tiff';
fetch(url)
  .then(response => response.arrayBuffer())
  .then(arrayBuffer => fromArrayBuffer(arrayBuffer))
  .then(tiff => tiff.getImage())
  .then(image => {
      console.log(image);
      const vectorSource = new VectorTileSource({
            tileUrlFunction: function (tileCoord) {
              // Use the tile coordinate as a pseudo URL for caching purposes
              return JSON.stringify(tileCoord);
            },
            tileLoadFunction: function (tile, url) {
              const tileCoord = JSON.parse(url);
              const tileGrid = vectorSource.getTileGrid();
              const extent = tileGrid.getTileCoordExtent(tileCoord);
              const center = getCenter(extent);

              // 1. Project tile center to GeoTIFF's CRS (WGS84 - EPSG:4326) if needed
              const mapProjection = getProjection('EPSG:3857'); // Assuming map is in this
              const geoTiffProjection = getProjection('EPSG:4326'); // From gdalinfo
              const centerWGS84 = transform(center, mapProjection, geoTiffProjection);

              // 2. Use GeoTIFF's geotransform to get pixel coordinates
              const modelTiepoint = image.getFileDirectory().ModelTiepoint;
              const xGeo = modelTiepoint[3]; // Longitude of top-left of first pixel
              const yGeo = modelTiepoint[4]; // Latitude of top-left of first pixel

              const pixelScale = image.getFileDirectory().ModelPixelScale;
              const pixelSizeX = pixelScale[0];
              const pixelSizeY = -Math.abs(pixelScale[1]); // Ensure negative for latitude

              let pixelX = Math.floor((centerWGS84[0] - xGeo) / pixelSizeX - 0.5);
              let pixelY = Math.floor((centerWGS84[1] - yGeo) / pixelSizeY - 0.5);

              console.log([pixelX, pixelY]);
              // 3. Read pixel values for U and V (assuming bands 0 and 1)
              image.readRasters({ window: [pixelX, pixelY, pixelX + 1, pixelY + 1] })
                .then(rasters => {
                  const u = rasters[0][0]; // Value from band 1
                  const v = rasters[1][0]; // Value from band 2
                  const direction = Math.atan2(v, u) * (180 / Math.PI);

                  const feature = new Feature({
                    geometry: new Point(center), // Keep geometry in map's projection
                  });
                  feature.setProperties({ u: u, v: v, direction: direction, });
                  tile.setFeatures([feature]);
                });
            },
          });
    vectorLayer.setSource(vectorSource);
  })
  .catch(error => console.error('Error loading GeoTIFF:', error));

