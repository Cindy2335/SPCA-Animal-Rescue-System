import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { WebViewMessageEvent } from "react-native-webview";
import { WebView } from "react-native-webview";
import type {
  LatLng,
  Region,
  ReportLocationMapHandle,
  ReportLocationMapProps,
} from "./ReportLocationMap.types";
import { ROODEPOORT_REPORT_REGION } from "./ReportLocationMap.types";

type MapMessage =
  | { type: "press" | "markerDrag"; coordinate: LatLng }
  | { type: "region"; region: Region };

function zoomForRegion(region: Region) {
  const delta = Math.max(region.longitudeDelta, region.latitudeDelta, 0.0001);
  return Math.max(2, Math.min(19, Math.round(Math.log2(360 / delta))));
}

function mapCommand(command: Record<string, unknown>) {
  return `window.updateReportMap(${JSON.stringify(command)}); true;`;
}

function createMapHtml(markerTitle: string) {
  const safeTitle = JSON.stringify(markerTitle);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; background: #e8eef2; }
      .report-pin {
        width: 24px;
        height: 24px;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        background: #0f6ea8;
        box-shadow: 0 2px 7px rgba(0,0,0,.35);
        transform: rotate(-45deg);
      }
      .leaflet-control-attribution { font-size: 9px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const send = (message) =>
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      const map = L.map("map", { zoomControl: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "",
        html: '<div class="report-pin"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 29]
      });
      let marker = null;
      let applyingNativeUpdate = false;

      function coordinate(latlng) {
        return { latitude: latlng.lat, longitude: latlng.lng };
      }

      function setMarker(value) {
        if (!value) {
          if (marker) map.removeLayer(marker);
          marker = null;
          return;
        }

        const latlng = [value.latitude, value.longitude];
        if (!marker) {
          marker = L.marker(latlng, { icon: pinIcon, draggable: true, title: ${safeTitle} })
            .addTo(map);
          marker.on("dragend", () =>
            send({ type: "markerDrag", coordinate: coordinate(marker.getLatLng()) })
          );
        } else {
          marker.setLatLng(latlng);
        }
      }

      map.on("click", (event) => {
        const value = coordinate(event.latlng);
        setMarker(value);
        send({ type: "press", coordinate: value });
      });

      map.on("moveend", () => {
        if (applyingNativeUpdate) {
          applyingNativeUpdate = false;
          return;
        }
        const center = map.getCenter();
        const bounds = map.getBounds();
        send({
          type: "region",
          region: {
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
            longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest())
          }
        });
      });

      window.updateReportMap = (command) => {
        if (command.type === "initialize" || command.type === "region") {
          applyingNativeUpdate = true;
          map.setView(
            [command.region.latitude, command.region.longitude],
            command.zoom,
            { animate: command.animate === true }
          );
        }
        if (Object.prototype.hasOwnProperty.call(command, "marker")) {
          setMarker(command.marker);
        }
      };
    </script>
  </body>
</html>`;
}

const ReportLocationMap = forwardRef<ReportLocationMapHandle, ReportLocationMapProps>(
  (
    {
      markerTitle,
      onMarkerDragEnd,
      onPress,
      onRegionChangeComplete,
      region = ROODEPOORT_REPORT_REGION,
      selectedCoordinate,
      style,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const mapReadyRef = useRef(false);
    const html = useMemo(() => createMapHtml(markerTitle), [markerTitle]);

    const inject = useCallback((command: Record<string, unknown>) => {
      webViewRef.current?.injectJavaScript(mapCommand(command));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        animateToRegion(nextRegion) {
          inject({
            type: "region",
            region: nextRegion,
            zoom: zoomForRegion(nextRegion),
            animate: true,
          });
        },
      }),
      [inject]
    );

    useEffect(() => {
      if (mapReadyRef.current) {
        inject({ type: "marker", marker: selectedCoordinate });
      }
    }, [inject, selectedCoordinate]);

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as MapMessage;

          if (message.type === "press") {
            onPress({ nativeEvent: { coordinate: message.coordinate } });
          } else if (message.type === "markerDrag") {
            onMarkerDragEnd({ nativeEvent: { coordinate: message.coordinate } });
          } else if (message.type === "region") {
            onRegionChangeComplete(message.region);
          }
        } catch {
          // Ignore messages not created by the embedded map.
        }
      },
      [onMarkerDragEnd, onPress, onRegionChangeComplete]
    );

    return (
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={style}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        onLoadEnd={() => {
          mapReadyRef.current = true;
          inject({
            type: "initialize",
            region,
            zoom: zoomForRegion(region),
            marker: selectedCoordinate,
          });
        }}
        onError={(event) =>
          console.error("Could not load the OpenStreetMap report map", event.nativeEvent)
        }
      />
    );
  }
);

ReportLocationMap.displayName = "ReportLocationMap";

export default ReportLocationMap;
