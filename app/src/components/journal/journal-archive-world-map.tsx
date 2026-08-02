import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Expand, Globe2, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import MediaLightbox from "@/components/journal/media-lightbox";
import {
  clusterJournalArchiveMapPins,
  type JournalArchiveMapPin,
} from "@/lib/journal/archive";
import { cn } from "@/lib/utils";

const TILE_SIZE = 256;
const WORLD_CENTER = { lat: 20, lon: 0 };
const WORLD_ZOOM = 1;
const DEFAULT_MAP_SIZE = { width: 448, height: 224 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 12;

function clampLat(lat: number): number {
  return Math.max(-85.0511, Math.min(85.0511, lat));
}

function clampZoom(zoom: number): number {
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

function getMapViewport(
  pins: JournalArchiveMapPin[],
  fitBounds: boolean,
  size: { width: number; height: number }
): { lat: number; lon: number; zoom: number } {
  if (!pins.length || !fitBounds) {
    return { ...WORLD_CENTER, zoom: WORLD_ZOOM };
  }

  if (pins.length === 1) {
    return { lat: pins[0].lat, lon: pins[0].lon, zoom: 4 };
  }

  const bounds = pins.reduce(
    (acc, pin) => ({
      minLat: Math.min(acc.minLat, pin.lat),
      maxLat: Math.max(acc.maxLat, pin.lat),
      minLon: Math.min(acc.minLon, pin.lon),
      maxLon: Math.max(acc.maxLon, pin.lon),
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

  for (let zoom = 6; zoom >= MIN_ZOOM; zoom -= 1) {
    const xs = pins.map((pin) => lonToTileX(pin.lon, zoom));
    const ys = pins.map((pin) => latToTileY(pin.lat, zoom));
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

export interface JournalArchiveMapClusterSelection {
  entryDates: string[];
  placeLabel: string;
}

interface JournalArchiveWorldMapProps {
  pins: JournalArchiveMapPin[];
  onSelectCluster: (selection: JournalArchiveMapClusterSelection) => void;
  className?: string;
}

interface WorldMapSurfaceProps {
  pins: JournalArchiveMapPin[];
  className?: string;
  ariaLabel: string;
  fitBounds: boolean;
  interactive: boolean;
  fullscreen?: boolean;
  showExpandButton?: boolean;
  onOpenFullscreen?: () => void;
  onSelectCluster?: (selection: JournalArchiveMapClusterSelection) => void;
}

function WorldMapSurface({
  pins,
  className,
  ariaLabel,
  fitBounds,
  interactive,
  fullscreen = false,
  showExpandButton = false,
  onOpenFullscreen,
  onSelectCluster,
}: WorldMapSurfaceProps) {
  const { t } = useTranslation("journal");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);
  const [mapSize, setMapSize] = useState(DEFAULT_MAP_SIZE);
  const viewport = useMemo(
    () => getMapViewport(pins, fitBounds, mapSize),
    [fitBounds, pins, mapSize]
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

  const pinsKey = useMemo(
    () =>
      pins
        .map((pin) => `${pin.entryId}:${pin.lat}:${pin.lon}`)
        .join("|"),
    [pins]
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

  useEffect(() => {
    setZoomDelta(0);
    setCenterOffsetTile({ x: 0, y: 0 });
  }, [pinsKey, fitBounds]);

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

  const clusters = useMemo(
    () => clusterJournalArchiveMapPins(pins, zoom),
    [pins, zoom]
  );

  const markers = useMemo(() => {
    return clusters.map((cluster) => ({
      cluster,
      left: (lonToTileX(cluster.lon, zoom) - centerTile.x) * TILE_SIZE,
      top: (latToTileY(cluster.lat, zoom) - centerTile.y) * TILE_SIZE,
    }));
  }, [centerTile, clusters, zoom]);

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
      moved: false,
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
      setAbsoluteZoom(pinchRef.current.startZoom + Math.log2(scale));
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }
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
      aria-label={ariaLabel}
      className={cn(
        "relative touch-none overflow-hidden bg-muted",
        interactive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
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

        {markers.map(({ cluster, left, top }) => {
          const count = cluster.pins.length;
          const isCluster = count > 1;
          const newest = cluster.pins[0];
          const title = isCluster
            ? `${cluster.placeLabel} · ${count}`
            : `${newest?.displayName ?? cluster.placeLabel} · ${newest?.entryDate ?? ""}`;

          return (
            <button
              key={cluster.id}
              type="button"
              title={title}
              aria-label={
                isCluster
                  ? t("archive.mapClusterAria", {
                      place: cluster.placeLabel,
                      count,
                    })
                  : t("archive.mapPinAria", {
                      place: newest?.displayName ?? cluster.placeLabel,
                      date: newest?.entryDate ?? "",
                    })
              }
              className={cn(
                "absolute z-[1] flex -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm",
                fullscreen
                  ? isCluster
                    ? "h-8 min-w-8 px-1.5"
                    : "h-7 w-7"
                  : isCluster
                    ? "h-4 min-w-4 px-0.5 pointer-events-none"
                    : "h-3 w-3 pointer-events-none"
              )}
              style={{ left, top }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (!fullscreen || !onSelectCluster) return;
                onSelectCluster({
                  entryDates: cluster.pins.map((pin) => pin.entryDate),
                  placeLabel: cluster.placeLabel,
                });
              }}
            >
              {fullscreen ? (
                isCluster ? (
                  <span className="leading-none tabular-nums" aria-hidden>
                    {count}
                  </span>
                ) : (
                  <span className="leading-none" aria-hidden>
                    {newest?.dayEmoji?.trim() || "📍"}
                  </span>
                )
              ) : isCluster ? (
                <span className="scale-75 leading-none tabular-nums" aria-hidden>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {showExpandButton ? (
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
          title={t("archive.openWorldMap")}
          aria-label={t("archive.openWorldMap")}
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

      {fullscreen ? (
        <p className="pointer-events-none absolute inset-x-2 top-2 rounded-md bg-background/90 px-2 py-1 text-center text-[11px] text-muted-foreground shadow-sm">
          {pins.length > 0
            ? t("archive.worldMapHint", { count: pins.length })
            : t("archive.worldMapEmpty")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Compact globe control for the journal archive search row.
 * Opens a fullscreen world map of days with places; pin/cluster taps
 * jump to a day or filter the list to that location.
 */
export default function JournalArchiveWorldMap({
  pins,
  onSelectCluster,
  className,
}: JournalArchiveWorldMapProps) {
  const { t } = useTranslation("journal");
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const handleSelect = (selection: JournalArchiveMapClusterSelection) => {
    setFullscreenOpen(false);
    onSelectCluster(selection);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setFullscreenOpen(true)}
        className={cn(
          "relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-muted shadow-none transition-opacity hover:opacity-90",
          className
        )}
        title={t("archive.openWorldMap")}
        aria-label={t("archive.openWorldMap")}
      >
        <WorldMapSurface
          pins={pins}
          className="h-full w-full"
          ariaLabel={t("archive.worldMapPreviewAria")}
          fitBounds={false}
          interactive={false}
        />
        <span className="pointer-events-none absolute inset-0 flex items-end justify-end p-1">
          <span className="rounded-full bg-background/90 p-0.5 text-muted-foreground shadow-sm">
            <Globe2 className="h-3 w-3" aria-hidden />
          </span>
        </span>
      </button>

      <MediaLightbox
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        title={t("archive.worldMapTitle")}
        closeLabel={t("archive.closeWorldMap")}
        contentClassName="h-full max-h-full w-full max-w-none p-3 sm:p-6"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="h-full min-h-0 w-full overflow-hidden rounded-xl border bg-background shadow-2xl">
          <WorldMapSurface
            pins={pins}
            className="h-full rounded-none border-0"
            ariaLabel={t("archive.worldMapTitle")}
            fitBounds={pins.length > 0}
            interactive
            fullscreen
            onSelectCluster={handleSelect}
          />
        </div>
      </MediaLightbox>
    </>
  );
}
