import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import BARANGAY_PINS from '../../shared/data/nagcarlanBarangayPins.json';

export type ListingLocation = {
  latitude: number;
  longitude: number;
  locality?: string | null;
};

const NAGCARLAN_BOUNDS = {
  south: 14.062935025000058,
  north: 14.195296738000025,
  west: 121.34516506300008,
  east: 121.48317533400007,
};

const PINS_JSON = JSON.stringify(BARANGAY_PINS).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
const NAGCARLAN_GEOJSON = require('../../shared/data/nagcarlanBarangays.json');
const POLYGONS_JSON = JSON.stringify(NAGCARLAN_GEOJSON.features.map((feature: any) => ({
  name: feature.properties.BrgyName,
  rings: feature.geometry.coordinates,
}))).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
const BARANGAY_PIN_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 1C7.3 1 1 7.3 1 15c0 10.5 14 24 14 24s14-13.5 14-24C29 7.3 22.7 1 15 1Z" fill="#f97316" stroke="#fff" stroke-width="2"/><text x="15" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">B</text></svg>')}`;
const SELECTED_PIN_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 25 15 25s15-14 15-25C31 7.7 24.3 1 16 1Z" fill="#2563eb" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>')}`;
const MAP_SOURCE = {
  html: `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=4,user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{width:100%;height:100%;margin:0;background:#e7ede6}
    .selected-pin{background:transparent;border:0}
    .selected-pin img{display:block;width:32px;height:42px}
    .barangay-pin{background:transparent;border:0}
    .barangay-pin img{display:block;width:30px;height:40px}
    .barangay-label{position:relative;left:15px;top:2px;display:inline-block;padding:2px 4px;border-radius:3px;white-space:nowrap;background:#fff;color:#9a3412;font:700 10px sans-serif;contain:layout paint}
    #map:not(.labels-on) .barangay-label{display:none}
    .leaflet-map-pane,.leaflet-tile-pane,.leaflet-marker-pane{will-change:transform}
    .leaflet-control-attribution{font-size:9px!important}
    .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important;font-size:24px!important}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const bounds=L.latLngBounds([${NAGCARLAN_BOUNDS.south},${NAGCARLAN_BOUNDS.west}],[${NAGCARLAN_BOUNDS.north},${NAGCARLAN_BOUNDS.east}]);
    const map=L.map('map',{center:[14.1291159,121.4141702],zoom:13,minZoom:8,maxZoom:19,maxBounds:bounds,maxBoundsViscosity:1,scrollWheelZoom:false,touchZoom:true,doubleClickZoom:true,zoomControl:true,dragging:true,zoomAnimation:true,fadeAnimation:false});
    function labels(){map.getContainer().classList.toggle('labels-on',map.getZoom()>=14)}
    map.on('zoomend',labels);labels();
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,updateWhenZooming:false,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const barangays=${POLYGONS_JSON};
    const pinIcon=L.divIcon({className:'selected-pin',html:'<img src="${SELECTED_PIN_SVG}" alt="Selected location"/>',iconSize:[32,42],iconAnchor:[16,41]});
    let selectedMarker=null;
    function pointInRing(point,ring){
      let inside=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
        if(((yi>point[1])!==(yj>point[1]))&&(point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi))inside=!inside;
      }
      return inside;
    }
    function findBarangay(lat,lng){
      const point=[lng,lat];
      for(let i=0;i<barangays.length;i++){
        const rings=barangays[i].rings;
        if(rings.length&&pointInRing(point,rings[0])&&!rings.slice(1).some(function(hole){return pointInRing(point,hole)}))return barangays[i].name;
      }
      return null;
    }
    function selectLocation(latitude,longitude){
      const locality=findBarangay(latitude,longitude);
      const inNagcarlanBounds=latitude>=${NAGCARLAN_BOUNDS.south}&&latitude<=${NAGCARLAN_BOUNDS.north}&&longitude>=${NAGCARLAN_BOUNDS.west}&&longitude<=${NAGCARLAN_BOUNDS.east};
      if(!locality&&!inNagcarlanBounds)return;
      const point=[latitude,longitude];
      if(!selectedMarker)selectedMarker=L.marker(point,{icon:pinIcon,zIndexOffset:1000}).addTo(map);
      else selectedMarker.setLatLng(point);
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'location',latitude:latitude,longitude:longitude,locality:locality}));
    }
    window.syncSelectedLocation=function(latitude,longitude){
      const point=[latitude,longitude];
      if(!selectedMarker)selectedMarker=L.marker(point,{icon:pinIcon,zIndexOffset:1000}).addTo(map);
      else selectedMarker.setLatLng(point);
      if(!bounds.contains(point))map.setMaxBounds(null);
      map.setView(point,Math.max(map.getZoom(),15),{animate:false});
    };
    ${PINS_JSON}.forEach(function(pin){
      const safeName=String(pin.name).replace(/[&<>"']/g,function(char){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])});
      const icon=L.divIcon({className:'barangay-pin',html:'<img src="${BARANGAY_PIN_SVG}" alt=""/><span class="barangay-label">Barangay '+safeName+'</span>',iconSize:[30,42],iconAnchor:[15,39]});
      L.marker([pin.latitude,pin.longitude],{icon:icon,keyboard:false,interactive:false}).addTo(map);
    });
    __MAP_CLICK_HANDLER__
  </script>
</body>
</html>`,
};

const MAP_STYLE = StyleSheet.absoluteFill;

export function BarangayListingMap({ onSelect, onUseCurrentLocation, fullScreen = false, selectedLocation, interactive = true, height }: { onSelect?: (location: ListingLocation) => void; onUseCurrentLocation?: () => void; fullScreen?: boolean; selectedLocation: ListingLocation | null; interactive?: boolean; height?: number }) {
  const webViewRef = React.useRef<WebView>(null);
  const source = React.useMemo(() => ({
    html: MAP_SOURCE.html.replace(
      '__MAP_CLICK_HANDLER__',
      interactive ? 'map.on("click",function(event){selectLocation(event.latlng.lat,event.latlng.lng)});' : '',
    ),
  }), [interactive]);
  const syncSelectedLocation = React.useCallback(() => {
    if (!selectedLocation) return;
    webViewRef.current?.injectJavaScript(`window.syncSelectedLocation&&window.syncSelectedLocation(${selectedLocation.latitude},${selectedLocation.longitude});true;`);
  }, [selectedLocation]);

  React.useEffect(() => {
    syncSelectedLocation();
  }, [syncSelectedLocation]);

  const handleMessage = React.useCallback((event: WebViewMessageEvent) => {
    try {
      const selected = JSON.parse(event.nativeEvent.data) as { type?: string; latitude: number; longitude: number; locality?: string };
      if (selected.type !== 'location') return;
      if (!Number.isFinite(selected.latitude) || !Number.isFinite(selected.longitude)) return;
      onSelect?.({ latitude: selected.latitude, longitude: selected.longitude, locality: selected.locality });
    } catch {
      return;
    }
  }, [onSelect]);

  return (
    <View style={[styles.mapFrame, height ? { height } : null, fullScreen && styles.fullScreenMap]}>
      <WebView
        ref={webViewRef}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        androidLayerType="hardware"
        overScrollMode="never"
        setBuiltInZoomControls={false}
        cacheEnabled
        onMessage={handleMessage}
        onLoadEnd={syncSelectedLocation}
        style={MAP_STYLE}
      />
      {onUseCurrentLocation && (
        <TouchableOpacity onPress={onUseCurrentLocation} activeOpacity={0.85} style={styles.currentLocationButton}>
          <Feather name="crosshair" size={17} color="#164e3b" />
          <Text style={styles.currentLocationText}>Use My Location</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e7ede6',
  },
  fullScreenMap: {
    flex: 1,
    height: undefined,
    borderRadius: 0,
  },
  currentLocationButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  currentLocationText: {
    color: '#164e3b',
    fontSize: 12,
    fontWeight: '700',
  },
});
