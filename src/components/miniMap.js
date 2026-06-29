'use client';

import { useEffect, useRef, useState } from 'react';
import { requests } from '@/utils/requests';

/**
 * MiniMap
 *
 * Displays all points associated with one or more makers on a small interactive map.
 * Supports layer switching between modern and historic map layers.
 *
 * Props:
 *   makerDocumentIds – string | string[]  one or more maker documentIds
 */
export default function MiniMap({ makerDocumentIds }) {
  const ids = Array.isArray(makerDocumentIds)
    ? makerDocumentIds
    : makerDocumentIds
    ? [makerDocumentIds]
    : [];

  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [points, setPoints] = useState([]);
  const [currentLayer, setCurrentLayer] = useState('positron');

  if (ids.length === 0) {
    return (
      <div className="w-full h-64 rounded border border-zinc-300 flex items-center justify-center bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">No maker specified</p>
      </div>
    );
  }

  // Handle layer changes
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const switchLayer = async () => {
      try {
        if (currentLayer === 'positron') {
          // Hide historic layers if they exist
          if (map.current.getLayer('historic-london-1893-layer')) {
            map.current.setLayoutProperty('historic-london-1893-layer', 'visibility', 'none');
          }
          if (map.current.getLayer('historic-osgb10k-1888-layer')) {
            map.current.setLayoutProperty('historic-osgb10k-1888-layer', 'visibility', 'none');
          }
        } else if (currentLayer === 'historic-london-1893') {
          // Hide other historic layer
          if (map.current.getLayer('historic-osgb10k-1888-layer')) {
            map.current.setLayoutProperty('historic-osgb10k-1888-layer', 'visibility', 'none');
          }

          // Fetch TileJSON and add as source/layer
          const response = await fetch(
            'https://api.maptiler.com/tiles/uk-oslondon1k1893/tiles.json?key=ivo1hejMto8SOQMBcG4y'
          );
          const tileJson = await response.json();

          // Add source if it doesn't exist
          if (!map.current.getSource('historic-london-1893')) {
            map.current.addSource('historic-london-1893', {
              type: 'raster',
              tiles: tileJson.tiles,
              tileSize: tileJson.tileSize || 256,
              attribution: tileJson.attribution,
            });
          }

          // Add layer if it doesn't exist
          if (!map.current.getLayer('historic-london-1893-layer')) {
            map.current.addLayer(
              {
                id: 'historic-london-1893-layer',
                type: 'raster',
                source: 'historic-london-1893',
                paint: { 'raster-opacity': 1 },
              },
              'points-layer'
            );
          } else {
            map.current.setLayoutProperty('historic-london-1893-layer', 'visibility', 'visible');
          }
        } else if (currentLayer === 'historic-osgb10k-1888') {
          // Hide other historic layer
          if (map.current.getLayer('historic-london-1893-layer')) {
            map.current.setLayoutProperty('historic-london-1893-layer', 'visibility', 'none');
          }

          // Fetch TileJSON and add as source/layer
          const response = await fetch(
            'https://api.maptiler.com/tiles/uk-osgb10k1888/tiles.json?key=ivo1hejMto8SOQMBcG4y'
          );
          const tileJson = await response.json();

          // Add source if it doesn't exist
          if (!map.current.getSource('historic-osgb10k-1888')) {
            map.current.addSource('historic-osgb10k-1888', {
              type: 'raster',
              tiles: tileJson.tiles,
              tileSize: tileJson.tileSize || 256,
              attribution: tileJson.attribution,
            });
          }

          // Add layer if it doesn't exist
          if (!map.current.getLayer('historic-osgb10k-1888-layer')) {
            map.current.addLayer(
              {
                id: 'historic-osgb10k-1888-layer',
                type: 'raster',
                source: 'historic-osgb10k-1888',
                paint: {
                  'raster-opacity': 1,
                },
              },
              'points-layer'
            );
          } else {
            map.current.setLayoutProperty('historic-osgb10k-1888-layer', 'visibility', 'visible');
          }
        }
      } catch (error) {
        console.error('Error switching map layer:', error);
        setErrorMessage('Error loading map layer');
      }
    };

    switchLayer();
  }, [currentLayer, isMapReady]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');

        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [-2.5, 52],
          zoom: 4,
        });

        map.current.on('load', () => {
          setIsMapReady(true);
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error initializing map.');
      }
    };

    initMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Fetch and display points for all makers
  useEffect(() => {
    if (!isMapReady || !map.current || ids.length === 0) return;

    // Palette for colouring points by maker
    const COLOURS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

    const fetchPointsForMakers = async () => {
      try {
        setIsLoading(true);

        // Fetch all makers in parallel
        const responses = await Promise.all(
          ids.map((id) => requests.makersExtended.get(id, { populate: 'Points' }))
        );

        const allFeatures = [];

        responses.forEach((response, index) => {
          const maker = response?.data;
          const associatedPoints = maker?.Points ?? [];
          const colour = COLOURS[index % COLOURS.length];
          const makerName =
            maker?.Label ||
            [maker?.First_name, maker?.Surname].filter(Boolean).join(' ') ||
            maker?.Organisation_Name ||
            `Maker #${maker?.id}`;

          associatedPoints
            .filter((p) => p.Latitude && p.Longitude)
            .forEach((point) => {
              allFeatures.push({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [point.Longitude, point.Latitude],
                },
                properties: {
                  id: point.id,
                  documentId: point.documentId,
                  Point_ID: point.Point_ID,
                  colour,
                  makerName,
                },
              });
            });
        });

        setPoints(allFeatures);

        if (allFeatures.length === 0) {
          setErrorMessage('No locations available.');
          setIsLoading(false);
          return;
        }

        const geojson = { type: 'FeatureCollection', features: allFeatures };

        if (!map.current.getSource('points')) {
          map.current.addSource('points', { type: 'geojson', data: geojson });
        } else {
          map.current.getSource('points').setData(geojson);
        }

        if (!map.current.getLayer('points-layer')) {
          map.current.addLayer({
            id: 'points-layer',
            type: 'circle',
            source: 'points',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                0, 2, 10, 4, 15, 8,
              ],
              'circle-color': ['get', 'colour'],
              'circle-opacity': 0.8,
            },
          });
        }

        if (!map.current.getLayer('points-labels-layer')) {
          map.current.addLayer({
            id: 'points-labels-layer',
            type: 'symbol',
            source: 'points',
            layout: {
              'text-field': ['get', 'makerName'],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 11,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': ['get', 'colour'],
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            },
          });
        }

        map.current.on('mouseenter', 'points-layer', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'points-layer', () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Fit bounds to all points
        const maplibregl = (await import('maplibre-gl')).default;
        const bounds = allFeatures.reduce(
          (b, feature) => b.extend(feature.geometry.coordinates),
          new maplibregl.LngLatBounds(allFeatures[0].geometry.coordinates, allFeatures[0].geometry.coordinates)
        );
        map.current.fitBounds(bounds, { padding: 40 });

        setErrorMessage('');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error loading locations.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPointsForMakers();
  }, [isMapReady, ids.join(',')]);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCurrentLayer('positron')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              currentLayer === 'positron'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            Modern
          </button>
          <button
            type="button"
            onClick={() => setCurrentLayer('historic-london-1893')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              currentLayer === 'historic-london-1893'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            1893
          </button>
          <button
            type="button"
            onClick={() => setCurrentLayer('historic-osgb10k-1888')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              currentLayer === 'historic-osgb10k-1888'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            1888
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Loading…</p>
          )}
          {errorMessage && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{errorMessage}</p>
          )}
          {!isLoading && points.length > 0 && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {points.length} location{points.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
      <div
        ref={mapContainer}
        className="w-full h-[480px] relative overflow-hidden rounded border border-zinc-300 dark:border-zinc-600"
      />
    </div>
  );
}
