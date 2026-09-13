const urlParams = new URLSearchParams(window.location.search);
const guid = urlParams.get('guid');

const { DateTime } = luxon;


function formatForDatetimeLocal(isoString) {
    if (!isoString) return "";

    const date = new Date(isoString);

    const pad = (n) => n.toString().padStart(2, '0');

    return (
        date.getFullYear() + "-" +
        pad(date.getMonth() + 1) + "-" +
        pad(date.getDate()) + "T" +
        pad(date.getHours()) + ":" +
        pad(date.getMinutes())
    );
}

window.onload = function () {
    fetch(`/tournaments/${guid}/`)
        .then(res => res.json())
        .then(data => {
            console.log(data.data[0]);
            const t = Array.isArray(data.data) ? data.data[0] : data.data;

            document.getElementById('automated').value = t.automated === true;
            document.getElementById('recurr-every').value = t[`recurr-every-days`] || '';
            document.getElementById('MapPool').value = t['map-pool'] || 'none';
            document.getElementById('map').value = t.map || '';
            document.getElementById('track').value = t.track || '';
            document.getElementById('is-custom-map').value = t['is-custom-map'] === 1;
            document.getElementById('custom-map-guid').value = t['custom-map'] || null;
            document.getElementById('custom-map-title').value = t['custom-map-title'] || null;
            document.getElementById('id').value = t.id || null;
            document.getElementById('title').value = t.title || null;
            document.getElementById('description').value = t.description || null;
            document.getElementById('call-to-action').value = t['call-to-action'] || null;
            document.getElementById('prize-description').value = t['prize-description'] || null;
            document.getElementById('prize-url').value = t['prize-url'] || null;
            document.getElementById('image-url').value = t['image-url'] || null;
            document.getElementById('video-url').value = t['video-url'] || null;
            document.getElementById('streaming-url').value = t['streaming-url'] || null;
            document.getElementById('terms-and-conditions-url').value = t['terms-and-conditions-url'] || null,
                document.getElementById('region').value = t['region'] || "us",
                document.getElementById('max-players').value = t['max-players'] || null,
                document.getElementById('register-start').value = formatForDatetimeLocal(t['register-start']) || null,
                document.getElementById('register-end').value = formatForDatetimeLocal(t['register-end']) || null,
                document.getElementById('status').value = t['status'] || null,
                document.getElementById('type').value = t['type'] || null,
                document.getElementById('progression').value = t['progression'] || 'auto',
                document.getElementById('allow-new-registration').value = t['allow-new-registration'] === 1,
                document.getElementById('lan-support').value = t['lan-support'] === 1,
                document.getElementById('server-ip').value = t['server-ip'] || null,
                document.getElementById('disable-public-spectators').value = t['disable-public-spectators'] === 1,
                document.getElementById('private').value = t['private'] === 1,
                document.getElementById('penalty').value = t['penalty'] === 1,
                document.getElementById('drl-pilot-mode').value = t['drl-pilot-mode'] === 1,
                document.getElementById('drone-guid').value = t['drone-guid'] || null,
                document.getElementById('drone-class').value = t['drone-class'] || null,
                document.getElementById('countdown').value = t['countdown'] === 1,
                document.getElementById('minimum-skill').value = t['minimum-skill'] || 0,
                document.getElementById('age-check').value = t['age-check'] === 1,
                document.getElementById('age-check-number').value = t['age-check-number'] || 0
        })
        .catch(error => {
            console.error('Error:', error);
        });

    const MapSearchInput = document.getElementById('MapSearchInput');

    MapSearchInput.addEventListener('input', (event) => {

        const url = '/admin/maps/?q=' + encodeURIComponent(event.target.value);

        fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                const tableBody = document.getElementById('MapSelector');

                if (data.data.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="4">No maps available.</td></tr>';
                    return;
                }
                const rows = data.data.data.map(Map => `
                    <option value="${Map.guid}">${Map['map-title']}</option>
                `).join('');

                tableBody.innerHTML = rows;
            })
            .catch(error => {
                console.error('Error:', error);
                alert(error)
                document.getElementById('map-data').innerHTML =
                    '<tr><td colspan="4">Failed to load data. Please try again later.</td></tr>';
            });
    });

    const MapSelector = document.getElementById('MapSelector');

    MapSelector.addEventListener('change', (event) => {
        const selectedMapGuid = event.target.value;

        if (selectedMapGuid) {
            const url = `/admin/maps/?guid=${selectedMapGuid}`;

            fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => {
                    document.getElementById('map').value = data.data.data[0]['map-id'];
                    document.getElementById('track').value = data.data.data[0]['track'] ? data.data.data[0]['track'] : '';
                    document.getElementById('is-custom-map').value = data.data.data[0]['track'] ? false : true;
                    document.getElementById('custom-map-guid').value = data.data.data[0]['guid'];
                    document.getElementById('custom-map-title').value = data.data.data[0]['map-title'];
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        }
    })
};

function UpdateMapPools() {
    const url = '/admin/map-pool/';

    fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const tableBody = document.getElementById('MapPool');

            if (data.data.length === 0) {
                return;
            }
            const rows = [
                '<option value="">None</option>',
                ...data.data.map(Pool => `<option value="${Pool.pool_name}">${Pool.pool_name}</option>`)
            ].join('');

            tableBody.innerHTML = rows;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function loadTournamentRounds() {
    const url = `/tournaments/${guid}/`;

    fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const tableBody = document.getElementById('round-data');
            if (!data.data[0].rounds || data.data[0].rounds.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="2">No Rounds available.</td></tr>';
                return;
            }

            // Clear any existing rows
            tableBody.innerHTML = '';

            data.data[0].rounds.forEach(round => {
                const tr = document.createElement('tr');

                const titleTd = document.createElement('td');
                titleTd.textContent = round.title;
                tr.appendChild(titleTd);

                const actionTd = document.createElement('td');
                const button = document.createElement('button');
                button.textContent = 'Modify';
                button.addEventListener('click', () => {
                    const targetUrl = `/admin/tournaments/modify/round/?RoundNumber=${encodeURIComponent(round.roundNumber)}&guid=${encodeURIComponent(guid)}`;
                    window.location.href = targetUrl;
                });
                actionTd.appendChild(button);

                tr.appendChild(actionTd);
                tableBody.appendChild(tr);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            alert(error)
            document.getElementById('round-data').innerHTML =
                '<tr><td colspan="4">Failed to load data. Please try again later.</td></tr>';
        });
}



function SubmitForm() {
    try {
        const url = '/admin/tournaments/update/' + guid;

        const registerStart = document.getElementById("register-start").value;
        const registerEnd = document.getElementById("register-end").value;

        const startUTC = luxon.DateTime.fromISO(registerStart, {
            zone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });

        const endUTC = luxon.DateTime.fromISO(registerEnd, {
            zone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });

        const formData = {
            "automated": document.getElementById('automated').value === 'true',
            "recurr_every_days": parseInt(document.getElementById('recurr-every').value) || null,
            "map_pool": document.getElementById('MapPool').value || null,
            "map": document.getElementById('map').value || null,
            "track": document.getElementById('track').value || null,
            "is_custom_map": document.getElementById('is-custom-map').value === 'true',
            "custom_map_guid": document.getElementById('custom-map-guid').value || null,
            "custom_map_title": document.getElementById('custom-map-title').value || null,
            "id": document.getElementById('id').value || null,
            "title": document.getElementById('title').value || null,
            "description": document.getElementById('description').value || null,
            "call_to_action": document.getElementById('call-to-action').value || null,
            "prize_description": document.getElementById('prize-description').value || null,
            "prize_url": document.getElementById('prize-url').value || null,
            "image_url": document.getElementById('image-url').value || null,
            "video_url": document.getElementById('video-url').value || null,
            "streaming_url": document.getElementById('streaming-url').value || null,
            "terms_and_conditions_url": document.getElementById('terms-and-conditions-url').value || null,
            "region": document.getElementById('region').value || null,
            "max_players": parseInt(document.getElementById('max-players').value) || null,
            "register_start": startUTC || null,
            "register_end": endUTC || null,
            "status": document.getElementById('status').value || null,
            "type": document.getElementById('type').value || null,
            "progression": document.getElementById('progression').value || null,
            "allow_new_registration": document.getElementById('allow-new-registration').value === 'true',
            "lan_support": document.getElementById('lan-support').value === 'true',
            "server_ip": document.getElementById('server-ip').value || null,
            "disable_public_spectators": document.getElementById('disable-public-spectators').value === 'true',
            "private": document.getElementById('private').value === 'true',
            "penalty": document.getElementById('penalty').value === 'true',
            "drl_pilot_mode": document.getElementById('drl-pilot-mode').value === 'true',
            "drone_guid": document.getElementById('drone-guid').value || null,
            "drone_class": parseInt(document.getElementById('drone-class').value) || null,
            "countdown": document.getElementById('countdown').value === 'true',
            "minimum_skill": parseInt(document.getElementById('minimum-skill').value) || null,
            "age_check": document.getElementById('age-check').value === 'true',
            "age_check_number": parseInt(document.getElementById('age-check-number').value) || null
        }

        fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                window.location.href = '/admin/tournaments/';
            })
            .catch(error => {
                console.error('Error:', error);
                alert(error)
            });
    } catch (error) {
        alert('Error: ' + error);
    }
}









function Delete() {
    try {
        const url = '/admin/tournaments/delete/' + guid;


        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                window.location.href = '/admin/tournaments/';
            })
            .catch(error => {
                console.error('Error:', error);
                alert(error)
            });
    } catch (error) {
        alert('Error: ' + error);
    }
}