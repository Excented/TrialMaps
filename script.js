const tomtomApiKey = 'ABzLP8IMYmrYslCAoLa5pidifxbyrhY8';

const map = L.map('map', { zoomControl: false, maxZoom: 20 }).setView([14.0667, 121.3250], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 20
}).addTo(map);

let trafficLayer = L.tileLayer('https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=' + tomtomApiKey, {
    attribution: 'Traffic data © TomTom',
    maxZoom: 20
}).addTo(map);

setInterval(() => {
    map.removeLayer(trafficLayer);
    trafficLayer = L.tileLayer('https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=' + tomtomApiKey, {
        attribution: 'Traffic data © TomTom',
        maxZoom: 20
    }).addTo(map);
}, 20000);

let userMarker = null;
let searchedMarker = null;
const sanPabloBounds = L.latLngBounds([[13.9, 121.2], [14.2, 121.4]]);
let graphLayer = null;
let graphVisible = false;
let isFirstRecenter = true;

const toggleButton = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        container.innerHTML = `<button style="background-color: white; border: 1px solid #ccc; padding: 5px 10px; cursor: pointer; border-radius: 5px;">Toggle Graph</button>`;
        container.onclick = () => {
            graphVisible = !graphVisible;
            if (graphLayer) {
                if (graphVisible) {
                    map.addLayer(graphLayer);
                } else {
                    map.removeLayer(graphLayer);
                }
            }
        };
        return container;
    }
});

new toggleButton({ position: 'topright' }).addTo(map);

fetch('export.geojson')
    .then(response => response.json())
    .then(data => {
        graphLayer = L.geoJSON(data, {
            style: function(feature) {
                return { color: feature.properties.color || '#0000ff' };
            },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 5,
                    fillColor: feature.properties.color || '#0000ff',
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            }
        });
    })
    .catch(error => {
        console.error('Error loading GeoJSON data:', error);
    });

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = [position.coords.latitude, position.coords.longitude];
                if (isInSanPabloCity(userLocation[0], userLocation[1])) {
                    if (isFirstRecenter) {
                        map.setView(userLocation, 16);
                        isFirstRecenter = false;
                    }
                    userMarker = L.marker(userLocation, { icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }) }).addTo(map);
                    reverseGeocode(userLocation);
                } else {
                    alert("You are outside of San Pablo City.");
                }
            },
            (error) => {
                console.error('Error getting user location:', error);
                alert('Unable to retrieve your location. Please ensure location services are enabled.');
            }
        );
    } else {
        console.error('Geolocation is not supported by this browser.');
        alert('Geolocation is not supported by your browser.');
    }
}

function reverseGeocode(coordinates) {
    const [lat, lon] = coordinates;
    fetch(`https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${tomtomApiKey}`)
        .then(response => response.json())
        .then(data => {
            const address = data.addresses[0].address.freeformAddress;
            displayAddress(address);
        })
        .catch(error => {
            console.error('Error during reverse geocoding:', error);
            alert('Unable to retrieve address information.');
        });
}

function displayAddress(address) {
    const addressElement = document.createElement('div');
    addressElement.className = 'address-box';
    addressElement.textContent = `Your location: ${address}`;
    document.body.appendChild(addressElement);
}

document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        if (!userMarker) {
            alert("Please wait for your location to be detected.");
            return;
        }

        const query = this.value + ", San Pablo City, Laguna, Philippines";
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&bounded=1&viewbox=121.2,14.2,121.4,13.9`)
            .then(response => response.json())
            .then(data => {
                if (data.length > 0) {
                    const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];

                    if (!sanPabloBounds.contains(latlng)) {
                        alert("The searched location is outside San Pablo City.");
                        return;
                    }

                    if (searchedMarker) {
                        searchedMarker.setLatLng(latlng);
                    } else {
                        searchedMarker = L.marker(latlng, { icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }) }).addTo(map);
                    }

                    map.setView(latlng, 16);
                } else {
                    alert("Location not found in San Pablo City.");
                }
            })
            .catch(() => {
                alert("Failed to fetch location.");
            });
    }
});

function isInSanPabloCity(latitude, longitude) {
    return (
        latitude >= sanPabloBounds.getSouthWest().lat &&
        latitude <= sanPabloBounds.getNorthEast().lat &&
        longitude >= sanPabloBounds.getSouthWest().lng &&
        longitude <= sanPabloBounds.getNorthEast().lng
    );
}

function trackLocation(map) {
    map.locate({ setView: false, watch: true, enableHighAccuracy: true });

    map.on('locationfound', (e) => {
        const { lat, lng } = e.latlng;

        if (isInSanPabloCity(lat, lng)) {
            if (window.userMarker) {
                window.userMarker.remove();
            }

            window.userMarker = L.marker([lat, lng], { icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }) }).addTo(map);
        } else {
            alert("You are outside of San Pablo City.");
        }
    });

    map.on('locationerror', (e) => {
        console.error("Error getting location:", e.message);
    });
}

getLocation();
trackLocation(map);