import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Expand, MapPin, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import MediaLightbox from "@/components/journal/media-lightbox";
import type { LocationData } from "@/lib/db/types";
import { normalizeJournalLocationRoute } from "@/lib/journal";
import { cn } from "@/lib/utils";

const TILE_SIZE = 256;
const DEFAULT_CENTER = { lat: 20, lon: 0 };
const DEFAULT_MAP_SIZE = { width: 448, height: 224 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 18;

function clampLat(lat: number): number {
  return Math.max(-85.0511, Math.min(85.0511, lat));
}

function clampZoom(zoom: number): number {
  // OSM raster tiles require integer zoom levels in the URL.
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)));
}

function lonToTileX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (clampLat(lat) * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    2 ** zoom
  );
}

function getLocationCenter(locations: LocationData[]): LocationData | null {
  for (let i = locations.length - 1; i >= 0; i -= 1) {
    const loc = locations[i];
    if (loc.lat != null && loc.lon != null) return loc;
  }
  return null;
}

function getMapViewport(
  locations: LocationData[],
  fitBounds: boolean,
  size: { width: number; height: number }
): { lat: number; lon: number; zoom: number } {
  const mappedLocations = locations.filter(
    (loc) => loc.lat != null && loc.lon != null
  );
  if (!mappedLocations.length) {
    return { ...DEFAULT_CENTER, zoom: 2 };
  }

  if (!fitBounds || mappedLocations.length === 1) {
    const center = getLocationCenter(mappedLocations);
    return {
      lat: center?.lat ?? DEFAULT_CENTER.lat,
      lon: center?.lon ?? DEFAULT_CENTER.lon,
      zoom: 9,
    };
  }

  const bounds = mappedLocations.reduce(
    (acc, loc) => ({
      minLat: Math.min(acc.minLat, loc.lat ?? acc.minLat),
      maxLat: Math.max(acc.maxLat, loc.lat ?? acc.maxLat),
      minLon: Math.min(acc.minLon, loc.lon ?? acc.minLon),
      maxLon: Math.max(acc.maxLon, loc.lon ?? acc.maxLon),
    }),
    {
      minLat: 90,
      maxLat: -90,
      minLon: 180,
      maxLon: -180,
    }
  );
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  const usableWidth = Math.max(160, size.width - 48);
  const usableHeight = Math.max(120, size.height - 48);

  for (let zoom = 12; zoom >= MIN_ZOOM; zoom -= 1) {
    const xs = mappedLocations.map((loc) => lonToTileX(loc.lon ?? 0, zoom));
    const ys = mappedLocations.map((loc) => latToTileY(loc.lat ?? 0, zoom));
    const spanX = (Math.max(...xs) - Math.min(...xs)) * TILE_SIZE;
    const spanY = (Math.max(...ys) - Math.min(...ys)) * TILE_SIZE;
    if (spanX <= usableWidth && spanY <= usableHeight) {
      return { lat: centerLat, lon: centerLon, zoom };
    }
  }

  return { lat: centerLat, lon: centerLon, zoom: MIN_ZOOM };
}

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface JournalLocationMapPickerProps {
  locations: LocationData[];
  className?: string;
  ariaLabel?: string;
  /** Inline preview map. Set false when only the fullscreen viewer is needed. */
  showPreview?: boolean;
  /** Always show the bottom-left expand control on the preview. */
  showFullscreenButton?: boolean;
  /** Controlled fullscreen open state. */
  fullscreenOpen?: boolean;
  onFullscreenOpenChange?: (open: boolean) => void;
}

interface JournalLocationMapSurfaceProps {
  locations: LocationData[];
  className?: string;
  ariaLabel?: string;
  fitBounds: boolean;
  interactive: boolean;
  fullscreen?: boolean;
  showFullscreenButton?: boolean;
  onOpenFullscreen?: () => void;
}

function JournalLocationMapSurface({
  locations,
  className,
  ariaLabel,
  fitBounds,
  interactive,
  fullscreen = false,
  showFullscreenButton = false,
  onOpenFullscreen,
}: JournalLocationMapSurfaceProps) {
  const { t } = useTranslation("journal");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [mapSize, setMapSize] = useState(DEFAULT_MAP_SIZE);
  const viewport = useMemo(
    () => getMapViewport(locations, fitBounds, mapSize),
    [fitBounds, locations, mapSize]
  );
  const [zoomDelta, setZoomDelta] = useState(0);
  const [centerOffsetTile, setCenterOffsetTile] = useState({ x: 0, y: 0 });
  const zoom = clampZoom(viewport.zoom + zoomDelta);
  const targetCenterTile = useMemo(
    () => ({
      x: lonToTileX(viewport.lon, zoom),
      y: latToTileY(viewport.lat, zoom),
    }),
    [viewport.lat, viewport.lon, zoom]
  );
  const centerTile = useMemo(
    () => ({
      x: targetCenterTile.x + centerOffsetTile.x,
      y: targetCenterTile.y + centerOffsetTile.y,
    }),
    [centerOffsetTile, targetCenterTile]
  );

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setMapSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Reset pan/zoom when the fitted place set changes (stable key, not array identity).
  const locationsFitKey = useMemo(
    () =>
      `${fitBounds}|${locations
        .map(
          (loc) =>
            `${loc.displayName}:${loc.lat ?? ""}:${loc.lon ?? ""}`
        )
        .join("|")}`,
    [fitBounds, locations]
  );

  // Reset user zoom/pan whenever the location set or fit bounds change so a
  // new map view starts from its own default framing.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setZoomDelta(0);
    setCenterOffsetTile({ x: 0, y: 0 });
  }, [locationsFitKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const zoomBy = (delta: number) => {
    const nextZoom = clampZoom(zoom + delta);
    if (nextZoom === zoom) return;
    const scale = 2 ** (nextZoom - zoom);
    setCenterOffsetTile((currentOffset) => ({
      x: currentOffset.x * scale,
      y: currentOffset.y * scale,
    }));
    setZoomDelta(nextZoom - viewport.zoom);
  };

  const setAbsoluteZoom = (nextZoomRaw: number) => {
    const nextZoom = clampZoom(nextZoomRaw);
    if (nextZoom === zoom) return;
    const scale = 2 ** (nextZoom - zoom);
    setCenterOffsetTile((currentOffset) => ({
      x: currentOffset.x * scale,
      y: currentOffset.y * scale,
    }));
    setZoomDelta(nextZoom - viewport.zoom);
  };

  const tiles = useMemo(() => {
    const integerZoom = clampZoom(zoom);
    const baseX = Math.floor(centerTile.x);
    const baseY = Math.floor(centerTile.y);
    const maxTile = 2 ** integerZoom;
    const radiusX = Math.max(2, Math.ceil(mapSize.width / TILE_SIZE / 2) + 1);
    const radiusY = Math.max(2, Math.ceil(mapSize.height / TILE_SIZE / 2) + 1);
    const out: Array<{ x: number; y: number; left: number; top: number }> = [];

    for (let dx = -radiusX; dx <= radiusX; dx += 1) {
      for (let dy = -radiusY; dy <= radiusY; dy += 1) {
        const x = baseX + dx;
        const y = baseY + dy;
        if (y < 0 || y >= maxTile) continue;
        const wrappedX = ((x % maxTile) + maxTile) % maxTile;
        out.push({
          x: wrappedX,
          y,
          left: (x - centerTile.x) * TILE_SIZE,
          top: (y - centerTile.y) * TILE_SIZE,
        });
      }
    }

    return out;
  }, [centerTile, mapSize.height, mapSize.width, zoom]);

  const markers = useMemo(() => {
    return locations
      .map((loc, index) => {
        if (loc.lat == null || loc.lon == null) return null;
        return {
          loc,
          index,
          left: (lonToTileX(loc.lon, zoom) - centerTile.x) * TILE_SIZE,
          top: (latToTileY(loc.lat, zoom) - centerTile.y) * TILE_SIZE,
        };
      })
      .filter(
        (
          marker
        ): marker is {
          loc: LocationData;
          index: number;
          left: number;
          top: number;
        } => Boolean(marker)
      );
  }, [centerTile, locations, zoom]);

  const stopControlPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!interactive) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        startDistance: Math.max(1, pointerDistance(a, b)),
        startZoom: zoom,
        startOffsetX: centerOffsetTile.x,
        startOffsetY: centerOffsetTile.y,
      };
      dragRef.current = null;
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: centerOffsetTile.x,
      startOffsetY: centerOffsetTile.y,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!interactive) return;
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.max(1, pointerDistance(a, b));
      const scale = distance / pinchRef.current.startDistance;
      const nextZoom = pinchRef.current.startZoom + Math.log2(scale);
      setAbsoluteZoom(nextZoom);
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    setCenterOffsetTile({
      x: drag.startOffsetX - deltaX / TILE_SIZE,
      y: drag.startOffsetY - deltaY / TILE_SIZE,
    });
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen) {
      event.stopPropagation();
      event.preventDefault();
    }
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.stopPropagation();
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -1 : 1);
  };

  return (
    <div
      ref={mapRef}
      role="region"
      aria-label={ariaLabel ?? t("locations.mapAriaLabel")}
      className={cn(
        "relative h-56 touch-none overflow-hidden rounded-lg border bg-muted",
        interactive
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-default",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={handleWheel}
    >
      <div className="absolute left-1/2 top-1/2">
        {tiles.map((tile) => (
          <img
            key={`${clampZoom(zoom)}-${tile.x}-${tile.y}`}
            src={`https://tile.openstreetmap.org/${clampZoom(zoom)}/${tile.x}/${tile.y}.png`}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              width: TILE_SIZE,
              height: TILE_SIZE,
              left: tile.left,
              top: tile.top,
            }}
          />
        ))}

        {markers.map((marker) => (
          <div
            key={`${marker.index}-${marker.loc.displayName}-${marker.loc.lat}-${marker.loc.lon}`}
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
            style={{ left: marker.left, top: marker.top }}
            title={marker.loc.displayName}
            aria-hidden
          />
        ))}
      </div>

      {showFullscreenButton ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute bottom-2 left-2 z-10 h-9 w-9 bg-background shadow-sm"
          onPointerDown={stopControlPointer}
          onPointerUp={stopControlPointer}
          onPointerCancel={stopControlPointer}
          onClick={(event) => {
            event.stopPropagation();
            onOpenFullscreen?.();
          }}
          title={t("locations.openFullscreenMap")}
          aria-label={t("locations.openFullscreenMap")}
        >
          <Expand className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}

      {fullscreen ? (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-md border bg-background shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-none"
            onPointerDown={stopControlPointer}
            onPointerUp={stopControlPointer}
            onPointerCancel={stopControlPointer}
            onClick={(event) => {
              event.stopPropagation();
              zoomBy(1);
            }}
            aria-label={t("locations.zoomIn")}
          >
            <ZoomIn className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-none border-t"
            onPointerDown={stopControlPointer}
            onPointerUp={stopControlPointer}
            onPointerCancel={stopControlPointer}
            onClick={(event) => {
              event.stopPropagation();
              zoomBy(-1);
            }}
            aria-label={t("locations.zoomOut")}
          >
            <ZoomOut className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      {fullscreen && locations.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap gap-1.5">
          {locations.map((loc, index) => (
            <span
              key={`${index}-${loc.displayName}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm"
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">{loc.displayName}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function JournalLocationMapPicker({
  locations,
  className,
  ariaLabel,
  showPreview = true,
  showFullscreenButton = true,
  fullscreenOpen: controlledFullscreenOpen,
  onFullscreenOpenChange,
}: JournalLocationMapPickerProps) {
  const { t } = useTranslation("journal");
  const [uncontrolledFullscreenOpen, setUncontrolledFullscreenOpen] =
    useState(false);
  const fullscreenOpen =
    controlledFullscreenOpen ?? uncontrolledFullscreenOpen;
  const setFullscreenOpen =
    onFullscreenOpenChange ?? setUncontrolledFullscreenOpen;

  const uniqueLocations = useMemo(
    () => normalizeJournalLocationRoute({ locations }).locations,
    [locations]
  );

  const locationsKey = useMemo(
    () =>
      uniqueLocations
        .map(
          (loc, index) =>
            `${index}:${loc.displayName}:${loc.lat ?? ""}:${loc.lon ?? ""}`
        )
        .join("|"),
    [uniqueLocations]
  );

  return (
    <>
      {showPreview ? (
        <JournalLocationMapSurface
          key={`inline-${locationsKey}`}
          locations={uniqueLocations}
          className={className}
          ariaLabel={ariaLabel}
          fitBounds
          interactive
          showFullscreenButton={showFullscreenButton}
          onOpenFullscreen={() => setFullscreenOpen(true)}
        />
      ) : null}

      <MediaLightbox
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        title={t("locations.fullscreenTitle")}
        closeLabel={t("locations.closeFullscreenMap")}
        contentClassName="h-full max-h-full w-full max-w-none p-3 sm:p-6"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="h-full min-h-0 w-full overflow-hidden rounded-xl border bg-background shadow-2xl">
          <JournalLocationMapSurface
            key={`fullscreen-${locationsKey}`}
            locations={uniqueLocations}
            className="h-full rounded-none border-0"
            ariaLabel={t("locations.mapAriaLabel")}
            fitBounds
            interactive
            fullscreen
          />
        </div>
      </MediaLightbox>
    </>
  );
}
