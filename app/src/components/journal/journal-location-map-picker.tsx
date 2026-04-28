import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Expand, Loader2, MapPin, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocationData } from "@/lib/db/types";
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
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
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

function tileXToLon(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
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

interface JournalLocationMapPickerProps {
  locations: LocationData[];
  selectedLocation?: LocationData | null;
  picking?: boolean;
  onMapPick?: (coords: { lat: number; lon: number }) => void;
  readOnly?: boolean;
  className?: string;
  footerText?: string | null;
  ariaLabel?: string;
}

interface JournalLocationMapSurfaceProps extends JournalLocationMapPickerProps {
  fitBounds: boolean;
  interactive: boolean;
  fullscreen?: boolean;
  showFullscreenButton?: boolean;
  onCloseFullscreen?: () => void;
  onOpenFullscreen?: () => void;
}

function JournalLocationMapSurface({
  locations,
  selectedLocation = null,
  picking = false,
  onMapPick,
  readOnly = false,
  className,
  footerText,
  ariaLabel,
  fitBounds,
  interactive,
  fullscreen = false,
  showFullscreenButton = false,
  onCloseFullscreen,
  onOpenFullscreen,
}: JournalLocationMapSurfaceProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  } | null>(null);
  const [mapSize, setMapSize] = useState(DEFAULT_MAP_SIZE);
  const mapLocations = useMemo(
    () => (selectedLocation ? [...locations, selectedLocation] : locations),
    [locations, selectedLocation]
  );
  const viewport = useMemo(
    () => getMapViewport(mapLocations, fitBounds, mapSize),
    [fitBounds, mapLocations, mapSize]
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

  const tiles = useMemo(() => {
    const baseX = Math.floor(centerTile.x);
    const baseY = Math.floor(centerTile.y);
    const maxTile = 2 ** zoom;
    const out: Array<{ x: number; y: number; left: number; top: number }> = [];

    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dy = -2; dy <= 2; dy += 1) {
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
  }, [centerTile, zoom]);

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

  const selectedMarker =
    selectedLocation?.lat != null && selectedLocation.lon != null
      ? {
          left:
            (lonToTileX(selectedLocation.lon, zoom) - centerTile.x) * TILE_SIZE,
          top:
            (latToTileY(selectedLocation.lat, zoom) - centerTile.y) * TILE_SIZE,
        }
      : null;
  const resolvedFooterText =
    footerText ??
    (readOnly ? null : "Click the map to add or replace a location");

  const stopControlPointer = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={mapRef}
      role={readOnly || !onMapPick ? "region" : "button"}
      tabIndex={readOnly || !onMapPick ? undefined : 0}
      aria-label={
        ariaLabel ??
        (readOnly ? "Map of listed locations" : "Pick a location on the map")
      }
      className={cn(
        "relative h-56 touch-none overflow-hidden rounded-lg border bg-muted",
        !interactive
          ? "cursor-default"
          : picking
            ? "cursor-progress"
            : onMapPick
              ? "cursor-crosshair"
              : "cursor-grab active:cursor-grabbing",
        className
      )}
      onPointerDown={(event) => {
        if (fullscreen) {
          event.stopPropagation();
          event.preventDefault();
        }
        if (!interactive || picking) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startOffsetX: centerOffsetTile.x,
          startOffsetY: centerOffsetTile.y,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (fullscreen) {
          event.stopPropagation();
          event.preventDefault();
        }
        if (!interactive || picking || !dragRef.current) return;
        const drag = dragRef.current;
        if (drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
          drag.moved = true;
        }
        setCenterOffsetTile({
          x: drag.startOffsetX - deltaX / TILE_SIZE,
          y: drag.startOffsetY - deltaY / TILE_SIZE,
        });
      }}
      onPointerUp={(event) => {
        if (fullscreen) {
          event.stopPropagation();
          event.preventDefault();
        }
        if (!interactive || picking || !dragRef.current) return;
        const drag = dragRef.current;
        if (drag.pointerId !== event.pointerId) return;
        if (!drag.moved && onMapPick) {
          const box = event.currentTarget.getBoundingClientRect();
          const offsetX = event.clientX - box.left - box.width / 2;
          const offsetY = event.clientY - box.top - box.height / 2;
          const tileX = centerTile.x + offsetX / TILE_SIZE;
          const tileY = centerTile.y + offsetY / TILE_SIZE;
          onMapPick({
            lat: tileYToLat(tileY, zoom),
            lon: tileXToLon(tileX, zoom),
          });
        }
        dragRef.current = null;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }}
      onPointerCancel={(event) => {
        if (fullscreen) {
          event.stopPropagation();
          event.preventDefault();
        }
        dragRef.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && fullscreen) {
          onCloseFullscreen?.();
          return;
        }
        if (readOnly || !onMapPick) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onMapPick({
          lat: tileYToLat(centerTile.y, zoom),
          lon: tileXToLon(centerTile.x, zoom),
        });
      }}
      onWheel={(event) => {
        if (!interactive || !fullscreen) return;
        event.stopPropagation();
        event.preventDefault();
        zoomBy(event.deltaY > 0 ? -1 : 1);
      }}
    >
      <div className="absolute left-1/2 top-1/2">
        {tiles.map((tile) => (
          <img
            key={`${zoom}-${tile.x}-${tile.y}`}
            src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
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
            key={`${marker.index}-${marker.loc.displayName}`}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-full rounded-full shadow-sm",
              readOnly
                ? "flex h-6 w-6 items-center justify-center border-2 border-background bg-primary text-[10px] font-semibold text-primary-foreground"
                : "h-2.5 w-2.5 border-2 border-primary bg-background"
            )}
            style={{ left: marker.left, top: marker.top }}
            title={marker.loc.displayName}
            aria-hidden
          >
            {readOnly ? marker.index + 1 : null}
          </div>
        ))}

        {selectedMarker ? (
          <MapPin
            className="absolute h-7 w-7 -translate-x-1/2 -translate-y-full fill-background text-destructive drop-shadow"
            style={{ left: selectedMarker.left, top: selectedMarker.top }}
            aria-hidden
          />
        ) : null}
      </div>

      {showFullscreenButton ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-2 top-2 z-10 h-8 w-8 bg-background/85 shadow-sm backdrop-blur hover:bg-background"
          onPointerDown={stopControlPointer}
          onPointerUp={stopControlPointer}
          onPointerCancel={stopControlPointer}
          onClick={(event) => {
            event.stopPropagation();
            onOpenFullscreen?.();
          }}
          aria-label="Open fullscreen map"
        >
          <Expand className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}

      {fullscreen ? (
        <>
          <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border bg-background/90 shadow-sm backdrop-blur">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none"
              onPointerDown={stopControlPointer}
              onPointerUp={stopControlPointer}
              onPointerCancel={stopControlPointer}
              onClick={(event) => {
                event.stopPropagation();
                zoomBy(1);
              }}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none border-t"
              onPointerDown={stopControlPointer}
              onPointerUp={stopControlPointer}
              onPointerCancel={stopControlPointer}
              onClick={(event) => {
                event.stopPropagation();
                zoomBy(-1);
              }}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute bottom-3 left-3 z-10 h-10 w-10 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background"
            onPointerDown={stopControlPointer}
            onPointerUp={stopControlPointer}
            onPointerCancel={stopControlPointer}
            onClick={(event) => {
              event.stopPropagation();
              onCloseFullscreen?.();
            }}
            aria-label="Close fullscreen map"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </>
      ) : null}

      {resolvedFooterText ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-background/85 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
          {picking ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Resolving location...
            </span>
          ) : (
            resolvedFooterText
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function JournalLocationMapPicker({
  locations,
  selectedLocation = null,
  picking = false,
  onMapPick,
  readOnly = false,
  className,
  footerText,
  ariaLabel,
}: JournalLocationMapPickerProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const locationsKey = useMemo(
    () =>
      [...locations, ...(selectedLocation ? [selectedLocation] : [])]
        .map(
          (loc, index) =>
            `${index}:${loc.displayName}:${loc.lat ?? ""}:${loc.lon ?? ""}`
        )
        .join("|"),
    [locations, selectedLocation]
  );
  const fullscreenMap =
    fullscreenOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[70] flex bg-black/50 p-3 backdrop-blur-sm sm:p-6"
            style={{ pointerEvents: "auto" }}
            role="dialog"
            aria-modal="true"
            aria-label="Expanded locations map"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="min-h-0 w-full overflow-hidden rounded-xl border bg-background shadow-2xl">
              <JournalLocationMapSurface
                key={`fullscreen-${locationsKey}`}
                locations={locations}
                selectedLocation={selectedLocation}
                readOnly
                className="h-full rounded-none border-0"
                footerText={null}
                ariaLabel="Expanded map of locations visited"
                fitBounds
                interactive
                fullscreen
                onCloseFullscreen={() => setFullscreenOpen(false)}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <JournalLocationMapSurface
        key={`inline-${locationsKey}`}
        locations={locations}
        selectedLocation={selectedLocation}
        picking={picking}
        onMapPick={onMapPick}
        readOnly={readOnly}
        className={className}
        footerText={footerText}
        ariaLabel={ariaLabel}
        fitBounds={readOnly}
        interactive={!readOnly}
        showFullscreenButton={readOnly}
        onOpenFullscreen={() => setFullscreenOpen(true)}
      />

      {fullscreenMap}
    </>
  );
}
