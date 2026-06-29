'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requests } from '@/utils/requests';

/**
 * MapVisualisation
 *
 * Displays all points from the database on an interactive map using MapLibre GL.
 * Each point is rendered as a marker on the map and fills the full height of its container.
 */
export default function MapVisualisation() {
  const router = useRouter();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [points, setPoints] = useState([]);
  const [currentLayer, setCurrentLayer] = useState('positron');

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
                paint: {
                  'raster-opacity': 1,
                },
              },
              'points-layer' // Insert before points layer so points are visible
            );
          } else {
            // Just make it visible
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
              'points-layer' // Insert before points layer so points are visible
            );
          } else {
            // Just make it visible
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

  // Fetch and display points
  useEffect(() => {
    if (!isMapReady || !map.current) return;

    const fetchPoints = async () => {

      try {
        setIsLoading(true);
        const response = await requests.points.listAll({}, { pageSize: 100 });
        const pointsData = response?.data ?? [];
        setPoints(pointsData);

        // Add markers for each point
        const maplibregl = (await import('maplibre-gl')).default;
        
        // Convert points to GeoJSON FeatureCollection
        const features = pointsData
          .filter((p) => p.Latitude && p.Longitude)
          .map((point) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [point.Longitude, point.Latitude],
            },
            properties: {
              id: point.id,
              documentId: point.documentId,
              Point_ID: point.Point_ID,
            },
          }));

        const geojson = {
          type: 'FeatureCollection',
          features,
        };

        // Add GeoJSON source
        map.current.addSource('points', {
          type: 'geojson',
          data: geojson,
        });

        // Add circle layer with zoom-based scaling
        map.current.addLayer({
          id: 'points-layer',
          type: 'circle',
          source: 'points',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              10, 3,
              15, 6,
            ],
            'circle-color': '#2563eb',
            'circle-opacity': 0.8,
          },
        });

        // Add hover effect
        map.current.on('mouseenter', 'points-layer', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'points-layer', () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Add click handler to show makers popup
        map.current.on('click', 'points-layer', async (e) => {
          if (!e.features || e.features.length === 0) return;

          const feature = e.features[0];
          const pointDocumentId = feature.properties.documentId;
          const [lng, lat] = e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : feature.geometry.coordinates;

          // Close existing popup if any
          if (popupRef.current) {
            popupRef.current.remove();
          }

          // Create popup with loading state
          const html = document.createElement('div');
          html.className = 'p-2 min-w-max';

          const loadingDiv = document.createElement('div');
          loadingDiv.className = 'text-xs text-zinc-500';
          loadingDiv.textContent = 'Loading makers…';
          html.appendChild(loadingDiv);

          const maplibregl = (await import('maplibre-gl')).default;
          popupRef.current = new maplibregl.Popup({ offset: 25 })
            .setLngLat([lng, lat])
            .setDOMContent(html)
            .addTo(map.current);

          try {
            // Fetch point with makers on click
            const response = await requests.points.get(pointDocumentId, {
              populate: 'Makers',
            });

            const point = response?.data;
            const makers = point?.Makers ?? [];

            // Update popup content
            html.removeChild(loadingDiv);

            if (makers.length === 0) {
              const emptyDiv = document.createElement('div');
              emptyDiv.className = 'text-xs text-zinc-500';
              emptyDiv.textContent = 'No makers associated';
              html.appendChild(emptyDiv);
            } else {
              const list = document.createElement('ul');
              list.className = 'text-xs space-y-1';

              makers.forEach((maker) => {
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.className = 'text-blue-600 hover:text-blue-800 cursor-pointer underline';
                const makerName = [maker.First_name ?? maker.first_name, maker.Surname ?? maker.surname]
                  .filter(Boolean)
                  .join(' ') || maker.Organisation_Name || `Maker #${maker.id}`;

                // Extract years from dates
                const dateRange = [];
                if (maker.Date_1) dateRange.push(maker.Date_1?.split('-')[0]);
                if (maker.Date_2) dateRange.push(maker.Date_2?.split('-')[0]);

                const dateText = dateRange.length > 0 ? ` (${dateRange.join('–')})` : '';
                link.textContent = makerName + dateText;

                link.onclick = () => {
                  router.push(`/data/maker/detail?id=${maker.documentId}`);
                };

                item.appendChild(link);
                list.appendChild(item);
              });

              html.appendChild(list);
            }
          } catch (error) {
            html.removeChild(loadingDiv);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'text-xs text-red-600';
            errorDiv.textContent = 'Error loading makers';
            html.appendChild(errorDiv);
          }
        });

        // Fit bounds to all points if any exist
        if (features.length > 0) {
          const bounds = features.reduce(
            (b, feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              return b.extend([lng, lat]);
            },
            new maplibregl.LngLatBounds(
              features[0].geometry.coordinates,
              features[0].geometry.coordinates
            )
          );

          map.current.fitBounds(bounds, { padding: 50 });
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Error loading points.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoints();
  }, [isMapReady]);

  return (
    <div className="w-full min-h-screen flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 flex-shrink-0 px-2 pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentLayer('positron')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
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
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              currentLayer === 'historic-london-1893'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            OS London 1893
          </button>
          <button
            type="button"
            onClick={() => setCurrentLayer('historic-osgb10k-1888')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              currentLayer === 'historic-osgb10k-1888'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            OSGB 10k 1888
          </button>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {isLoading ? 'Loading points…' : `${points.length} point${points.length !== 1 ? 's' : ''} displayed`}
          </p>
          {errorMessage && (
            <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
          )}
        </div>
      </div>
      <div
        ref={mapContainer}
        className="w-full flex-1 relative overflow-hidden rounded border border-zinc-300 dark:border-zinc-600"
      />
    </div>
  );
}
