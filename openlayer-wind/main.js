import './style.css';

import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import {get as getProjection, transform} from 'ol/proj.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Style from 'ol/style/Style.js';
import Icon from 'ol/style/Icon.js';
import {getBottomRight} from 'ol/extent';
import {getTopLeft} from 'ol/extent';
import {getCenter} from 'ol/extent';

import {fromArrayBuffer} from "geotiff";

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

function metersPerSecondToKnotsString(metersPerSecond) {
    const knots = metersPerSecond * 1.94384;

    if (knots >= 0 && knots < 2) {
        return "0";
    } else if (knots >= 2 && knots < 5) {
        return "2";
    } else if (knots >= 5 && knots < 10) {
        return "5";
    } else if (knots >= 10 && knots < 15) {
        return "10";
    } else if (knots >= 15 && knots < 20) {
        return "15";
    } else if (knots >= 20 && knots < 25) {
        return "20";
    } else if (knots >= 25 && knots < 30) {
        return "25";
    } else if (knots >= 30 && knots < 35) {
        return "30";
    } else if (knots >= 35 && knots < 40) {
        return "35";
    } else if (knots >= 40 && knots < 45) {
        return "40";
    } else if (knots >= 45 && knots < 50) {
        return "45";
    } else if (knots >= 50 && knots < 55) {
        return "50";
    } else if (knots >= 55 && knots < 60) {
        return "55";
    } else if (knots >= 60 && knots < 65) {
        return "60";
    } else if (knots >= 65 && knots < 70) {
        return "65";
    } else if (knots >= 70 && knots < 75) {
        return "70";
    } else if (knots >= 75 && knots < 80) {
        return "75";
    } else if (knots >= 80 && knots < 85) {
        return "80";
    } else if (knots >= 85 && knots < 90) {
        return "85";
    } else if (knots >= 90 && knots < 95) {
        return "90";
    } else if (knots >= 95 && knots < 100) {
        return "95";
    } else if (knots >= 100 && knots < 105) {
        return "100";
    } else if (knots >= 105 && knots < 110) {
        return "105";
    } else if (knots >= 110 && knots < 115) {
        return "110";
    } else if (knots >= 115 && knots < 120) {
        return "115";
    } else if (knots >= 120 && knots < 125) {
        return "120";
    } else if (knots >= 125 && knots < 130) {
        return "125";
    } else if (knots >= 130 && knots < 135) {
        return "130";
    } else if (knots >= 135 && knots < 140) {
        return "135";
    } else if (knots >= 140 && knots < 145) {
        return "140";
    } else if (knots >= 145 && knots < 150) {
        return "145";
    } else if (knots >= 150 && knots < 155) {
        return "150";
    } else if (knots >= 155 && knots < 160) {
        return "155";
    } else if (knots >= 160 && knots < 165) {
        return "160";
    } else if (knots >= 165 && knots < 170) {
        return "165";
    } else if (knots >= 170 && knots < 175) {
        return "170";
    } else if (knots >= 175 && knots < 180) {
        return "175";
    } else if (knots >= 180 && knots < 185) {
        return "180";
    } else if (knots >= 185 && knots < 190) {
        return "185";
    } else {
        return "190";
    }
}

const vectorLayer = new VectorTileLayer({
    minZoom: 2,
    style: function (feature) {
        const properties = feature.getProperties();
        const windSpeed = Math.sqrt(properties.u * properties.u + properties.v * properties.v);
        const name = metersPerSecondToKnotsString(windSpeed);
        return new Style({
            image: new Icon({
                opacity: 1,
                src: `barbs/${name}.svg`, // 'data:image/svg+xml;utf8,' + svg,
                scale: 100, // Start with a scale of 1 and adjust as needed
                rotation: properties.direction,
            })
        });
    },
});

map.addLayer(vectorLayer);

function getAverageOfFloat64Array(float64Array) {
    if (!float64Array || float64Array.length === 0) {
        return 0; // Or handle the empty array case as needed (e.g., return NaN)
    }

    let sum = 0;
    for (let i = 0; i < float64Array.length; i++) {
        sum += float64Array[i];
    }

    return sum / float64Array.length;
}

const url = 'icon_global_WGS84_0125_single-level_2025041800_000_WIND_10M.tiff';
fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => fromArrayBuffer(arrayBuffer))
    .then(tiff => tiff.getImage())
    .then(image => {
        console.log(image);
        const vectorSource = new VectorTileSource({
            tileSize: 128,
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

                const topLeft = transform(getTopLeft(extent), mapProjection, geoTiffProjection);
                const bottomRight = transform(getBottomRight(extent), mapProjection, geoTiffProjection);

                // 2. Use GeoTIFF's geotransform to get pixel coordinates
                const modelTiepoint = image.getFileDirectory().ModelTiepoint;
                const xGeo = modelTiepoint[3]; // Longitude of top-left of first pixel
                const yGeo = modelTiepoint[4]; // Latitude of top-left of first pixel

                const pixelScale = image.getFileDirectory().ModelPixelScale;
                const pixelSizeX = pixelScale[0];
                const pixelSizeY = -Math.abs(pixelScale[1]); // Ensure negative for latitude

                const minPixelX = Math.floor((topLeft[0] - xGeo) / pixelSizeX);
                const maxPixelX = Math.ceil((bottomRight[0] - xGeo) / pixelSizeX);

                const minPixelY = Math.floor((topLeft[1] - yGeo) / pixelSizeY);
                const maxPixelY = Math.ceil((bottomRight[1] - yGeo) / pixelSizeY);

                // 3. Iterate and accumulate pixel values
                // image.readRasters({ bbox: [topLeft[0], topLeft[1], bottomRight[0], bottomRight[1]], resX: 0.1, resY: 0.1, bands: [0, 1] }) // Read both bands
                image.readRasters({
                    window: [minPixelX, minPixelY, maxPixelX, maxPixelY],
                    bands: [0, 1]
                }) // Read both bands
                    .then(rasters => {
                        const uValues = rasters[0];
                        const vValues = rasters[1];

                        const uAvg = getAverageOfFloat64Array(uValues);
                        const vAvg = getAverageOfFloat64Array(vValues);
                        const direction = Math.atan2(vAvg, uAvg);

                        const feature = new Feature({
                            geometry: new Point(center),
                        });
                        feature.setProperties({u: uAvg, v: vAvg, direction: direction,});
                        tile.setFeatures([feature]);
                    });
            },
        });
        vectorLayer.setSource(vectorSource);
    })
    .catch(error => console.error('Error loading GeoTIFF:', error));
